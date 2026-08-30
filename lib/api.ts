/**
 * Typed API client for the AI Support backend (FastAPI, see backend/).
 *
 * Base URL resolution order (see resolveApiUrl below):
 *   1. EXPO_PUBLIC_API_URL from .env — always wins (escape hatch).
 *   2. Android emulator: http://10.0.2.2:8000 (Android's alias for the host
 *      machine's loopback — "localhost" inside an emulator is the emulator itself).
 *   3. Physical Android phone via Expo Go / dev client over Wi-Fi: derived from
 *      the dev-server host (your computer's LAN IP), port 8000.
 *   4. Expo web / iOS simulator: http://localhost:8000 (shares the dev machine).
 *
 * NOTE: .env values are inlined at bundle time — restart `npx expo start --clear`
 * after changing .env.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

/** Android emulators identify themselves via Platform.constants. */
function isAndroidEmulator(): boolean {
  const c = Platform.constants as unknown as {
    Fingerprint?: string;
    Model?: string;
    Product?: string;
  };
  const id = [c.Fingerprint, c.Model, c.Product].filter(Boolean).join(" ");
  return /sdk_gphone|generic|emulator/i.test(id);
}

/**
 * Where is the Metro dev server? Different sources across Expo Go versions:
 *   - Constants.expoConfig.hostUri       (SDK 49+)
 *   - Constants.expoGoConfig.debuggerHost
 *   - Constants.manifest.debuggerHost    (legacy manifest)
 * Returns "host:port" or null.
 */
function devServerHost(): string | null {
  const c = Constants as unknown as {
    expoConfig?: { hostUri?: string } | null;
    expoGoConfig?: { debuggerHost?: string } | null;
    manifest?: { debuggerHost?: string } | null;
  };
  return (
    c.expoConfig?.hostUri ??
    c.expoGoConfig?.debuggerHost ??
    c.manifest?.debuggerHost ??
    null
  );
}

/** True when Expo Go is loading through a tunnel (e.g. *.exp.direct). */
function isTunnelMode(): boolean {
  const host = devServerHost();
  if (!host) return false;
  return !/^\d{1,3}(\.\d{1,3}){3}$/.test(host.split(":")[0] ?? "");
}

/**
 * When a phone loads the app over Wi-Fi (Expo Go / dev client), the dev-server
 * host is your computer's LAN IP, e.g. "192.168.1.10:8081" → backend on :8000.
 * Tunnel URLs (*.exp.direct) can't reach our backend, so only LAN IPs qualify.
 */
function lanBackendUrl(): string | null {
  const hostUri = devServerHost();
  if (!hostUri) return null;
  const host = hostUri.split(":")[0] ?? "";
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  return `http://${host}:8000`;
}

function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured;

  if (Platform.OS === "android") {
    if (isAndroidEmulator()) return "http://10.0.2.2:8000";
    return lanBackendUrl() ?? "http://localhost:8000";
  }
  return "http://localhost:8000";
}

const API_URL = resolveApiUrl();

if (__DEV__) {
  console.log(`[api] Backend base URL: ${API_URL}`);
}

/** Contextual hint when the backend can't be reached. */
function connectionErrorMessage(): string {
  if (Platform.OS === "android" && !isAndroidEmulator()) {
    if (isTunnelMode()) {
      return (
        "Expo is running in TUNNEL mode — the AI backend can't be reached " +
        "through the tunnel. Restart Expo with `npx expo start --lan --clear`, " +
        "make sure the phone is on the same Wi-Fi as this computer, then reload."
      );
    }
    return (
      `Can't reach the support server at ${API_URL}. ` +
      "Check that: (1) the backend runs with `uvicorn main:app --host 0.0.0.0`, " +
      "(2) Windows Firewall allows Python on private networks, " +
      "(3) the phone is on the same Wi-Fi as this computer."
    );
  }
  return (
    `Can't reach the support server at ${API_URL}. ` +
    "Make sure the backend is running (uvicorn main:app)."
  );
}


// --------------------------------- types -----------------------------------

export type ChatRole = "user" | "ai";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TicketCategory =
  | "ACCOUNT"
  | "BILLING"
  | "TECHNICAL"
  | "REFUND"
  | "SECURITY"
  | "FEATURE_REQUEST"
  | "GENERAL"
  | "OTHER";

export type RecommendedAction =
  | "AUTOMATIC_RESPONSE"
  | "HUMAN_REVIEW"
  | "ESCALATE";

export interface AgentStep {
  tool: string;
  input: string;
  output: string;
}

export interface TicketAnalysis {
  intent: string;
  category: TicketCategory;
  priority: TicketPriority;
  confidence: number;
  reasoning_summary: string;
  recommended_action: RecommendedAction;
  suggested_response: string;
  knowledge_used: string[];
  final_decision?: string;
  ai_failed?: boolean;
  created_at?: string;
}

export interface SubmitTicketInput {
  customer_name: string;
  customer_email: string;
  subject: string;
  message: string;
}

/** Response shape of POST /api/tickets and POST /api/chat/convert. */
export interface TicketSubmitResult {
  ticket_id: number;
  analysis: TicketAnalysis;
  ai_recommendation: RecommendedAction;
  decision: string;
  agent_trace: AgentStep[];
  ai_failed: boolean;
  status: string;
  auto_response_sent?: boolean;
  customer_name?: string;
  customer_email?: string;
  subject?: string;
}

export interface TicketListItem {
  ticket_id: number;
  customer_name: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
}

export interface TicketDetail {
  ticket: {
    id: number;
    subject: string;
    message: string;
    status: string;
    priority: string;
    category: string;
    customer_id: number | null;
    created_at: string;
  };
  customer: {
    id: number;
    name: string;
    email: string;
    plan: string;
    payment_status: string;
    subscription_status: string;
  } | null;
  analysis: TicketAnalysis | null;
}

export interface ActivityLog {
  id: number;
  ticket_id: number | null;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface StartChatResult {
  conversation_id: number;
  customer_email: string;
}

export interface ChatResult {
  reply: string;
  agent_trace: AgentStep[];
  conversation_id: number | null;
  /** True when the LLM failed and a fallback reply was returned. */
  ai_failed?: boolean;
}

export interface AuthUser {
  id?: number | null;
  name: string | null;
  email: string;
  plan?: string | null;
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  category?: string;
}

// ----------------------------- error handling ------------------------------

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(connectionErrorMessage());
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body?.detail === "string") detail = body.detail;
      else if (body?.detail != null) detail = JSON.stringify(body.detail);
    } catch {
      // keep the default message
    }
    throw new ApiError(detail, res.status);
  }

  return (await res.json()) as T;
}

// ------------------------------- endpoints ---------------------------------

export const api = {
  /** GET /api/health */
  health(): Promise<{ status: string }> {
    return request("/api/health");
  },

  /** POST /api/auth/register — Supabase Auth user (auto-confirmed) + profile */
  register(payload: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthUser> {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** POST /api/auth/forgot-password — send a Supabase password-reset link. */
  forgotPassword(email: string): Promise<{ status: string; sent: boolean }> {
    return request("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  /** POST /api/auth/login — password verified by Supabase Auth */
  login(payload: { email: string; password: string }): Promise<AuthUser> {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** GET /api/auth/me?email= — refresh the signed-in profile */
  me(email: string): Promise<AuthUser> {
    return request(`/api/auth/me?email=${encodeURIComponent(email)}`);
  },

  /** POST /api/tickets — submit a ticket, backend runs the AI analysis pipeline. */
  submitTicket(payload: SubmitTicketInput): Promise<TicketSubmitResult> {
    return request("/api/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** GET /api/tickets — list tickets with optional filters. */
  listTickets(filters: TicketFilters = {}): Promise<TicketListItem[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.category) params.set("category", filters.category);
    const qs = params.toString();
    return request(`/api/tickets${qs ? `?${qs}` : ""}`);
  },

  /** GET /api/tickets/{id} */
  getTicket(ticketId: number): Promise<TicketDetail> {
    return request(`/api/tickets/${ticketId}`);
  },

  /** GET /api/tickets/{id}/activity */
  getTicketActivity(ticketId: number): Promise<ActivityLog[]> {
    return request(`/api/tickets/${ticketId}/activity`);
  },

  /** POST /api/tickets/{id}/approve — approve the AI response and email it. */
  approveTicket(ticketId: number): Promise<{ status: string; email: unknown }> {
    return request(`/api/tickets/${ticketId}/approve`, { method: "POST" });
  },

  /** POST /api/tickets/{id}/respond — send a custom response to the customer. */
  respondToTicket(
    ticketId: number,
    responseText: string
  ): Promise<{ status: string; email: unknown }> {
    return request(`/api/tickets/${ticketId}/respond`, {
      method: "POST",
      body: JSON.stringify({ response_text: responseText }),
    });
  },

  /** POST /api/chat/start — note: customer_email is a QUERY parameter. */
  startChat(customerEmail: string): Promise<StartChatResult> {
    return request(
      `/api/chat/start?customer_email=${encodeURIComponent(customerEmail)}`,
      { method: "POST" }
    );
  },

  /** POST /api/chat — send conversation history, receive the AI reply. */
  sendChat(payload: {
    messages: ChatTurn[];
    conversation_id: number | null;
    customer_email: string | null;
  }): Promise<ChatResult> {
    return request("/api/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** POST /api/chat/convert — turn a live chat conversation into a ticket. */
  convertChatToTicket(payload: {
    conversation_id: number;
    customer_email: string;
    subject: string;
  }): Promise<TicketSubmitResult> {
    return request("/api/chat/convert", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export default api;

