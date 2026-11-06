import actionJson from '../schemas/action.schema.json';
import bridgeMessageJson from '../schemas/bridge-message.schema.json';
import pageModelJson from '../schemas/page-model.schema.json';

export interface PageModel {
  version: 1;
  url: string;
  title: string;
  lang: string;
  pageType: 'article' | 'search' | 'product' | 'checkout' | 'login' | 'form' | 'video' | 'table' | 'app' | 'other';
  capturedAt: string;
  viewport: { w: number; h: number; scrollY: number; scrollMax: number };
  outline: Array<{ level: number; text: string; ref: string }>;
  mainText: string;
  mainTextTruncated: boolean;
  elements: PageElement[];
  forms: PageForm[];
  tables: PageTable[];
  media: PageMedia[];
  overlays: PageOverlay[];
  screenshot?: { mime: 'image/png'; data?: string; marks: Record<string, string> };
  redactions: string[];
}

export interface PageElement {
  ref: string;
  role: string;
  name: string;
  tag: string;
  type: string;
  href: string;
  state: { disabled?: boolean; checked?: boolean; expanded?: boolean; required?: boolean; invalid?: boolean; selected?: boolean };
  rect: [number, number, number, number];
  onScreen: boolean;
  frame: string;
  selectorHints: { css: string; xpath: string; text: string };
}

export interface PageForm {
  ref: string;
  action: string;
  method: string;
  fields: Array<{ ref: string; label: string; type: string; required: boolean; value?: string; invalid: boolean }>;
}

export interface PageTable { ref: string; caption: string; headers: string[]; rows: string[][] }
export interface PageMedia { kind: 'video' | 'audio'; ref: string; paused: boolean; duration: number; currentTime: number }
export interface PageOverlay { kind: 'cookie-banner' | 'modal' | 'paywall'; ref: string; dismissRef: string }

export type ActionType =
  | 'click' | 'hover' | 'focus' | 'type' | 'press' | 'select' | 'check' | 'uncheck' | 'drag' | 'scroll'
  | 'upload' | 'download' | 'navigate' | 'back' | 'forward' | 'reload' | 'openTab' | 'switchTab'
  | 'closeTab' | 'duplicate' | 'waitFor' | 'handleDialog' | 'dismissOverlay' | 'readText' | 'screenshot'
  | 'extract' | 'copy' | 'paste' | 'fillForm' | 'setValue' | 'ask' | 'done' | 'abort';

export interface Action {
  id: string;
  type: ActionType;
  target?: string;
  args: Record<string, unknown>;
  expect?: Record<string, unknown>;
  risk: 'low' | 'medium' | 'high';
}

export type BridgeMessage =
  | { type: 'hello'; v: 1; device: string; caps: string[] }
  | { type: 'ping' | 'pong'; id?: string }
  | { type: 'command'; id: string; text: string; target?: string }
  | { type: 'say'; text: string; priority?: number }
  | { type: 'status'; state: string }
  | { type: 'result'; id: string; ok: boolean; text: string }
  | { type: 'examine'; id: string }
  | { type: 'pageModel'; id: string; model: Record<string, unknown> }
  | { type: 'confirm'; id: string; prompt: string }
  | { type: 'confirmed'; id: string; yes: boolean }
  | { type: 'stop'; id?: string };

export const pageModelSchema: object = pageModelJson;
export const actionSchema: object = actionJson;
export const bridgeMessageSchema: object = bridgeMessageJson;
