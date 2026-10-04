import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Desktop from './Desktop.jsx';
import { HostedKnobBridge } from './hostedKnob.js';
import desktopStyles from './desktop.css';
import appStyles from './apps.css';

const EMBEDDED_STYLES = `
:host{display:block;width:100%;height:100%;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;font-size:13px;color:#192130;text-align:left;line-height:normal;color-scheme:light;}
.desktop-mount{width:100%;height:100%;overflow:hidden;container-type:size;}
.desktop{width:100%;height:100%;min-width:0;min-height:0;}
.help-window{width:min(760px,calc(100% - 80px));max-height:calc(100% - 40px);}
@container (max-height:700px){
 .knob-panel.compact{bottom:16px;}
 .dock{gap:8px;padding:10px 13px 5px;border-radius:21px;}
 .dock .app-icon{width:44px;height:44px;}
}
`;

/** Mount in the host page without another document or another USB owner. */
export function mountDesktop(element, { sendConfig, onStatus } = {}) {
  if (!element || typeof element.attachShadow !== 'function')
    throw new TypeError('mountDesktop requires an HTML host element.');
  if (typeof sendConfig !== 'function')
    throw new TypeError('mountDesktop requires a parent sendConfig function.');
  const shadow = element.shadowRoot || element.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = desktopStyles.replace(':root', ':host') + appStyles + EMBEDDED_STYLES;
  const mount = document.createElement('div');
  mount.className = 'desktop-mount';
  shadow.append(style, mount);
  const root = createRoot(mount);
  let bridge;
  let enabled = false;
  let destroyed = false;
  const bridgeFactory = (callbacks) => {
    bridge = new HostedKnobBridge({
      ...callbacks,
      sendConfig,
      onStatus: (status) => { callbacks.onStatus(status); onStatus?.(status); },
    });
    return bridge;
  };
  const render = () => root.render(
    <Desktop embedded containerElement={element} bridgeFactory={bridgeFactory} enabled={enabled}/>,
  );
  flushSync(render);
  return {
    setConnected(connected) {
      if (!destroyed) bridge.setConnected(connected);
    },
    receive(state) {
      if (!destroyed) bridge.receive(state);
    },
    setEnabled(next) {
      next = Boolean(next);
      if (destroyed || next === enabled) return;
      if (!next) bridge.setEnabled(false);
      enabled = next;
      // Disable clears deferred gestures before returning to the host. Enable
      // first prepares the latest model value while configuration sends are gated.
      flushSync(render);
      if (next) bridge.setEnabled(true);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      bridge.setEnabled(false);
      flushSync(() => root.unmount());
      mount.remove();
      style.remove();
    },
  };
}
