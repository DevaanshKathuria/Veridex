declare module "is-local-ip" {
  export default function isLocalIp(address: string): boolean;
}

declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string });
    window: {
      document: {
        querySelector: (selector: string) => {
          getAttribute: (name: string) => string | null;
          textContent: string | null;
        } | null;
      };
    };
  }
}
