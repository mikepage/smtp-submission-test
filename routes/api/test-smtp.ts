import { define } from "../../utils.ts";
import type { SmtpTestResult, LogEntry } from "../../utils.ts";

interface RequestBody {
  hostname: string;
  port: number;
}

async function readSmtpResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  logs: LogEntry[]
): Promise<string[]> {
  const decoder = new TextDecoder();
  const lines: string[] = [];
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const crlfIndex = buffer.indexOf("\r\n");
      if (crlfIndex === -1) break;

      const line = buffer.slice(0, crlfIndex);
      buffer = buffer.slice(crlfIndex + 2);
      lines.push(line);

      logs.push({
        direction: "received",
        message: line,
        timestamp: Date.now(),
      });

      // Check if this is the final line (code followed by space)
      if (line.length >= 4 && line[3] === " ") {
        return lines;
      }
    }
  }

  return lines;
}

async function writeLine(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  line: string,
  logs: LogEntry[]
): Promise<void> {
  const encoder = new TextEncoder();
  logs.push({
    direction: "sent",
    message: line,
    timestamp: Date.now(),
  });
  await writer.write(encoder.encode(line + "\r\n"));
}

async function testImplicitTls(
  hostname: string,
  port: number
): Promise<SmtpTestResult> {
  const logs: LogEntry[] = [];
  let capabilities: string[] = [];
  let greeting = "";

  logs.push({
    direction: "info",
    message: `Connecting to ${hostname}:${port} with implicit TLS...`,
    timestamp: Date.now(),
  });

  try {
    const conn = await Deno.connect({ hostname, port });

    logs.push({
      direction: "info",
      message: "TCP connection established, upgrading to TLS...",
      timestamp: Date.now(),
    });

    const tlsConn = await Deno.startTls(conn, { hostname });

    logs.push({
      direction: "info",
      message: "TLS handshake successful",
      timestamp: Date.now(),
    });

    const reader = tlsConn.readable.getReader();
    const writer = tlsConn.writable.getWriter();

    try {
      // Read greeting
      const greetingLines = await readSmtpResponse(reader, logs);
      greeting = greetingLines.join("\n");

      // Send EHLO
      await writeLine(writer, `EHLO test.local`, logs);

      // Read EHLO response
      const ehloLines = await readSmtpResponse(reader, logs);
      capabilities = ehloLines
        .filter((line) => line.startsWith("250"))
        .map((line) => line.slice(4).trim())
        .filter((cap) => cap && cap !== hostname);

      // Send QUIT
      await writeLine(writer, "QUIT", logs);
      await readSmtpResponse(reader, logs);

      return {
        success: true,
        protocol: "implicit-tls",
        hostname,
        port,
        greeting,
        capabilities,
        tlsUpgraded: true,
        logs,
      };
    } finally {
      reader.releaseLock();
      writer.releaseLock();
      tlsConn.close();
    }
  } catch (error) {
    logs.push({
      direction: "error",
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    });

    return {
      success: false,
      protocol: "implicit-tls",
      hostname,
      port,
      error: error instanceof Error ? error.message : String(error),
      logs,
    };
  }
}

async function testStartTls(
  hostname: string,
  port: number
): Promise<SmtpTestResult> {
  const logs: LogEntry[] = [];
  let capabilities: string[] = [];
  let greeting = "";

  logs.push({
    direction: "info",
    message: `Connecting to ${hostname}:${port}...`,
    timestamp: Date.now(),
  });

  try {
    const conn = await Deno.connect({ hostname, port });

    logs.push({
      direction: "info",
      message: "TCP connection established",
      timestamp: Date.now(),
    });

    let reader = conn.readable.getReader();
    let writer = conn.writable.getWriter();

    try {
      // Read greeting
      const greetingLines = await readSmtpResponse(reader, logs);
      greeting = greetingLines.join("\n");

      // Send EHLO
      await writeLine(writer, `EHLO test.local`, logs);

      // Read EHLO response
      const ehloLines = await readSmtpResponse(reader, logs);
      capabilities = ehloLines
        .filter((line) => line.startsWith("250"))
        .map((line) => line.slice(4).trim())
        .filter((cap) => cap && cap !== hostname);

      // Check if STARTTLS is supported
      const supportsStartTls = capabilities.some(
        (cap) => cap.toUpperCase() === "STARTTLS"
      );

      if (!supportsStartTls) {
        await writeLine(writer, "QUIT", logs);
        await readSmtpResponse(reader, logs);

        return {
          success: true,
          protocol: "starttls",
          hostname,
          port,
          greeting,
          capabilities,
          tlsUpgraded: false,
          logs,
        };
      }

      // Send STARTTLS
      await writeLine(writer, "STARTTLS", logs);

      // Read STARTTLS response
      const startTlsLines = await readSmtpResponse(reader, logs);
      const startTlsResponse = startTlsLines[0] || "";

      if (!startTlsResponse.startsWith("220")) {
        return {
          success: false,
          protocol: "starttls",
          hostname,
          port,
          greeting,
          capabilities,
          tlsUpgraded: false,
          error: `STARTTLS rejected: ${startTlsResponse}`,
          logs,
        };
      }

      // Release locks before TLS upgrade
      reader.releaseLock();
      writer.releaseLock();

      logs.push({
        direction: "info",
        message: "Upgrading to TLS...",
        timestamp: Date.now(),
      });

      // Upgrade to TLS
      const tlsConn = await Deno.startTls(conn, { hostname });

      logs.push({
        direction: "info",
        message: "TLS handshake successful",
        timestamp: Date.now(),
      });

      reader = tlsConn.readable.getReader();
      writer = tlsConn.writable.getWriter();

      // Send EHLO again after TLS
      await writeLine(writer, `EHLO test.local`, logs);

      // Read new EHLO response (may have different capabilities post-TLS)
      const postTlsEhloLines = await readSmtpResponse(reader, logs);
      capabilities = postTlsEhloLines
        .filter((line) => line.startsWith("250"))
        .map((line) => line.slice(4).trim())
        .filter((cap) => cap && cap !== hostname);

      // Send QUIT
      await writeLine(writer, "QUIT", logs);
      await readSmtpResponse(reader, logs);

      reader.releaseLock();
      writer.releaseLock();
      tlsConn.close();

      return {
        success: true,
        protocol: "starttls",
        hostname,
        port,
        greeting,
        capabilities,
        tlsUpgraded: true,
        logs,
      };
    } catch (error) {
      try {
        reader.releaseLock();
        writer.releaseLock();
        conn.close();
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  } catch (error) {
    logs.push({
      direction: "error",
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    });

    return {
      success: false,
      protocol: "starttls",
      hostname,
      port,
      error: error instanceof Error ? error.message : String(error),
      logs,
    };
  }
}

export const handler = define.handlers({
  async POST(ctx) {
    try {
      const body: RequestBody = await ctx.req.json();
      const { hostname, port } = body;

      if (!hostname || !port) {
        return new Response(
          JSON.stringify({ error: "hostname and port are required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      let result: SmtpTestResult;

      if (port === 465) {
        result = await testImplicitTls(hostname, port);
      } else {
        result = await testStartTls(hostname, port);
      }

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
});
