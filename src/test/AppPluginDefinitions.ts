// Minimal obsidian stubs for vitest
export class Notice { constructor(_msg: string, _timeout?: number) {} }
export class TFile { path = ''; }
export class TFolder {}
export class TAbstractFile {}
export class App {}
export class Modal { app: any; constructor(app: any) { this.app = app; } }
export class Setting { constructor(_el: any) {} }
export class PluginSettingTab { app: any; constructor(app: any, _plugin: any) { this.app = app; } }
export class Scope {}
export class MarkdownRenderChild { containerEl: any; constructor(el: any) { this.containerEl = el; } }
export const Platform = { isDesktop: true, isMobile: false, isDesktopApp: true };
export function requestUrl(_req: any): Promise<any> { return Promise.resolve({}); }
