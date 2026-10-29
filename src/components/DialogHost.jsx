import React, {useLayoutEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import './DialogHost.css';

const focusableSelector = 'button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
const focusable = root => [...root.querySelectorAll(focusableSelector)].filter(node => !node.closest('[inert]') && node.getClientRects().length > 0);
const focusFirst = root => (root.querySelector('[data-dialog-initial-focus]') || focusable(root)[0] || root).focus();

function DialogLayer({dialog, active, index, register}) {
  const root = useRef(null);
  const opener = useRef(dialog.returnFocusRef?.current || document.activeElement);
  useLayoutEffect(() => {
    register(dialog.id, root.current);
    return () => {
      register(dialog.id, null);
      // The surviving layer must lose inert before its opener can receive focus.
      queueMicrotask(() => {
        const target = dialog.returnFocusRef?.current || opener.current;
        if (target?.isConnected && !target.closest('[inert]')) target.focus();
      });
    };
  }, [dialog.id]);
  useLayoutEffect(() => {
    if (active && !root.current.contains(document.activeElement)) focusFirst(root.current);
  }, [active]);
  useLayoutEffect(() => {
    // Replacing content can remove the focused action without firing focusin
    // (Help -> Data). Keep this layer/opener mounted and repair only escaped
    // modal focus; a nonmodal panel must still permit Return to workspace.
    if (active && dialog.modal && !root.current.contains(document.activeElement)) focusFirst(root.current);
  }, [active, dialog.modal, dialog.content]);
  return <div className={`dialog-layer ${dialog.modal ? 'dialog-layer-modal' : 'dialog-layer-panel'}`} style={{zIndex: index + 1}} inert={!active ? true : undefined} aria-hidden={!active ? true : undefined}>
    <div ref={root} role="dialog" aria-modal={dialog.modal && active ? true : undefined} aria-label={dialog.title} tabIndex={-1} data-dialog-id={dialog.id} className="dialog-focus-scope">{dialog.content}</div>
  </div>;
}

/** Ordered layers; onCloseTop receives the id of the one layer to dismiss.
 * A caller may omit returnFocusRef to capture the active opener automatically.
 * Confirmation content uses ordinary action/cancel buttons in a modal entry.
 */
export default function DialogHost({dialogs = [], onCloseTop}) {
  const host = useRef(null), nodes = useRef(new Map());
  const current = useRef({dialogs, onCloseTop});
  current.current = {dialogs, onCloseTop};
  const topModal = dialogs.findLast(dialog => dialog.modal);
  const register = (id, node) => node ? nodes.current.set(id, node) : nodes.current.delete(id);
  useLayoutEffect(() => {
    if (!topModal) return;
    const backgrounds = [...document.body.children].filter(node => node !== host.current && !['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName));
    const previous = backgrounds.map(node => [node, node.inert]);
    const overflow = document.body.style.overflow;
    backgrounds.forEach(node => { node.inert = true; });
    document.body.style.overflow = 'hidden';
    return () => {
      previous.forEach(([node, inert]) => { node.inert = inert; });
      document.body.style.overflow = overflow;
    };
  }, [Boolean(topModal)]);
  useLayoutEffect(() => {
    const keydown = event => {
      if (event.defaultPrevented || event.isComposing) return;
      const state = current.current, modal = state.dialogs.findLast(dialog => dialog.modal);
      const top = modal || state.dialogs.findLast(dialog => nodes.current.get(dialog.id)?.contains(document.activeElement));
      const root = top && nodes.current.get(top.id);
      if (!root) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        state.onCloseTop?.(top.id);
      } else if (event.key === 'Tab' && modal) {
        const items = focusable(root), first = items[0], last = items.at(-1);
        if (!items.length || !root.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last) || (event.shiftKey && (document.activeElement === first || document.activeElement === root))) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
          if (!items.length) root.focus();
        }
      }
    };
    const focusin = event => {
      const modal = current.current.dialogs.findLast(dialog => dialog.modal), root = modal && nodes.current.get(modal.id);
      if (root && !root.contains(event.target)) focusFirst(root);
    };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', focusin);
    };
  }, []);
  return createPortal(<div ref={host} className="dialog-host">{dialogs.map((dialog, index) => <DialogLayer key={dialog.id} dialog={dialog} index={index} active={!topModal || dialog.id === topModal.id} register={register}/>)}</div>, document.body);
}
