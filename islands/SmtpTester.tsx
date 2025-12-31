import { useSignal } from "@preact/signals";
import type { SmtpTestResult, LogEntry } from "../utils.ts";

export default function SmtpTester() {
  const hostname = useSignal("");
  const port = useSignal("587");
  const isLoading = useSignal(false);
  const result = useSignal<SmtpTestResult | null>(null);

  const handleTest = async () => {
    if (!hostname.value.trim()) return;

    isLoading.value = true;
    result.value = null;

    try {
      const response = await fetch("/api/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: hostname.value.trim(),
          port: parseInt(port.value, 10),
        }),
      });

      const data = await response.json();
      result.value = data;
    } catch (error) {
      result.value = {
        success: false,
        protocol: port.value === "465" ? "implicit-tls" : "starttls",
        hostname: hostname.value,
        port: parseInt(port.value, 10),
        error: error instanceof Error ? error.message : "Unknown error",
        logs: [],
      };
    } finally {
      isLoading.value = false;
    }
  };

  const handleClear = () => {
    hostname.value = "";
    port.value = "587";
    result.value = null;
  };

  const handleLoadSample = () => {
    hostname.value = "smtp.gmail.com";
    port.value = "587";
  };

  const getLogColor = (direction: LogEntry["direction"]) => {
    switch (direction) {
      case "sent":
        return "text-blue-600";
      case "received":
        return "text-green-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getLogPrefix = (direction: LogEntry["direction"]) => {
    switch (direction) {
      case "sent":
        return ">>> ";
      case "received":
        return "<<< ";
      case "error":
        return "ERR ";
      default:
        return "--- ";
    }
  };

  return (
    <div class="w-full">
      {/* Input Section */}
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">Server Details</h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Mail Server Hostname
            </label>
            <input
              type="text"
              value={hostname.value}
              onInput={(e) => hostname.value = (e.target as HTMLInputElement).value}
              placeholder="smtp.example.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Port
            </label>
            <select
              value={port.value}
              onChange={(e) => port.value = (e.target as HTMLSelectElement).value}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="587">587 (STARTTLS)</option>
              <option value="465">465 (Implicit TLS)</option>
              <option value="25">25 (SMTP)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div class="flex flex-wrap gap-3">
          <button
            onClick={handleTest}
            disabled={isLoading.value || !hostname.value.trim()}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading.value ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleClear}
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleLoadSample}
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Load Sample
          </button>
        </div>
      </div>

      {/* Results Section */}
      {result.value && (
        <div class="space-y-6">
          {/* Summary Card */}
          <div class={`rounded-lg p-6 ${
            result.value.success
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}>
            <div class="flex items-center gap-3 mb-2">
              <span class={`text-3xl font-bold ${
                result.value.success ? "text-green-600" : "text-red-600"
              }`}>
                {result.value.success ? "SUCCESS" : "FAILED"}
              </span>
            </div>
            <p class="text-gray-700">
              {result.value.success
                ? `Successfully connected to ${result.value.hostname}:${result.value.port} using ${
                    result.value.protocol === "implicit-tls" ? "Implicit TLS" : "STARTTLS"
                  }`
                : result.value.error || "Connection failed"}
            </p>
          </div>

          {/* Connection Details */}
          {result.value.success && (
            <div class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">Connection Details</h3>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <span class="text-sm text-gray-500">Protocol</span>
                  <p class="font-medium">
                    {result.value.protocol === "implicit-tls" ? "Implicit TLS (Port 465)" : "STARTTLS (Port 587)"}
                  </p>
                </div>
                <div>
                  <span class="text-sm text-gray-500">TLS Upgraded</span>
                  <p class="font-medium">
                    {result.value.tlsUpgraded ? "Yes" : "No"}
                  </p>
                </div>
              </div>

              {result.value.greeting && (
                <div class="mb-4">
                  <span class="text-sm text-gray-500">Server Greeting</span>
                  <p class="font-mono text-sm bg-gray-50 p-2 rounded mt-1">
                    {result.value.greeting}
                  </p>
                </div>
              )}

              {result.value.capabilities && result.value.capabilities.length > 0 && (
                <div>
                  <span class="text-sm text-gray-500">Server Capabilities</span>
                  <div class="flex flex-wrap gap-2 mt-2">
                    {result.value.capabilities.map((cap, i) => (
                      <span
                        key={i}
                        class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-mono"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Connection Log */}
          {result.value.logs.length > 0 && (
            <div class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">Connection Log</h3>
              <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre class="font-mono text-sm">
                  {result.value.logs.map((log, i) => (
                    <div key={i} class={getLogColor(log.direction)}>
                      <span class="text-gray-500 mr-2">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span>{getLogPrefix(log.direction)}</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          )}

          {/* Reference Section */}
          <details class="bg-white rounded-lg shadow">
            <summary class="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-50">
              SMTP Port Reference
            </summary>
            <div class="p-4 pt-0 border-t">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-gray-500">
                    <th class="pb-2">Port</th>
                    <th class="pb-2">Protocol</th>
                    <th class="pb-2">Description</th>
                  </tr>
                </thead>
                <tbody class="text-gray-700">
                  <tr class="border-t border-gray-100">
                    <td class="py-2 font-mono">25</td>
                    <td class="py-2">SMTP</td>
                    <td class="py-2">Standard SMTP relay (often blocked by ISPs)</td>
                  </tr>
                  <tr class="border-t border-gray-100">
                    <td class="py-2 font-mono">465</td>
                    <td class="py-2">SMTPS (Implicit TLS)</td>
                    <td class="py-2">TLS encryption from connection start</td>
                  </tr>
                  <tr class="border-t border-gray-100">
                    <td class="py-2 font-mono">587</td>
                    <td class="py-2">Submission (STARTTLS)</td>
                    <td class="py-2">Recommended for mail submission with STARTTLS upgrade</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
