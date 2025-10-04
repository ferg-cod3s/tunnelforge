// Lit Bridge - Custom element wrapper for Svelte components during migration
// This allows Svelte components to coexist with existing Lit components

export interface LitBridgeOptions {
  tagName: string;
  component: any;
  props?: Record<string, any>;
}

/**
 * Creates a custom element wrapper for a Svelte component
 * This allows Svelte components to be used as custom elements during migration
 */
export function createLitBridge(options: LitBridgeOptions) {
  const { tagName, component, props = {} } = options;

  return class extends HTMLElement {
    private svelteApp: any;
    private props: Record<string, any> = {};

    static get observedAttributes() {
      return Object.keys(props);
    }

    constructor() {
      super();
      this.props = { ...props };
    }

    connectedCallback() {
      // Get props from attributes
      this.updatePropsFromAttributes();

      // Create Svelte component instance
      this.svelteApp = new component({
        target: this,
        props: this.props
      });
    }

    disconnectedCallback() {
      // Clean up Svelte component
      if (this.svelteApp && typeof this.svelteApp.$destroy === 'function') {
        this.svelteApp.$destroy();
      }
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
      if (oldValue !== newValue) {
        this.props[name] = this.parseAttributeValue(newValue);
        if (this.svelteApp && typeof this.svelteApp.$set === 'function') {
          this.svelteApp.$set({ [name]: this.props[name] });
        }
      }
    }

    private updatePropsFromAttributes() {
      for (const attr of this.attributes) {
        this.props[attr.name] = this.parseAttributeValue(attr.value);
      }
    }

    private parseAttributeValue(value: string): any {
      // Try to parse as JSON first
      try {
        return JSON.parse(value);
      } catch {
        // If not JSON, check for boolean/number values
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;
        if (value === 'undefined') return undefined;

        // Try to parse as number
        const num = Number(value);
        if (!isNaN(num)) return num;

        // Return as string
        return value;
      }
    }

    // Method to update props programmatically
    updateProps(newProps: Record<string, any>) {
      this.props = { ...this.props, ...newProps };
      if (this.svelteApp && typeof this.svelteApp.$set === 'function') {
        this.svelteApp.$set(this.props);
      }
    }
  };
}

/**
 * Registers a Svelte component as a custom element
 */
export function registerSvelteComponent(options: LitBridgeOptions) {
  const { tagName } = options;
  const CustomElement = createLitBridge(options);

  if (!customElements.get(tagName)) {
    customElements.define(tagName, CustomElement);
  }

  return CustomElement;
}

/**
 * Utility to convert kebab-case to camelCase for prop mapping
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Utility to convert camelCase to kebab-case for attribute mapping
 */
export function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}