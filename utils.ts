import { createDefine } from "fresh";

export interface State {
  shared: string;
}

export const define = createDefine<State>();

export interface SmtpTestResult {
  success: boolean;
  protocol: "implicit-tls" | "starttls";
  hostname: string;
  port: number;
  greeting?: string;
  capabilities?: string[];
  tlsUpgraded?: boolean;
  error?: string;
  logs: LogEntry[];
}

export interface LogEntry {
  direction: "sent" | "received" | "info" | "error";
  message: string;
  timestamp: number;
}
