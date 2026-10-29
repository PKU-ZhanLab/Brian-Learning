import React from 'react';

/** A presentation-only consumer: retries/cancellation are owned by the caller. */
export default function WorkspaceStatus({status,onRetry,onCancel,onOpenResult}){
  if(!status||(!status.message&&!onOpenResult))return null;
  const {phase,message}=status;
  return <div className={phase==='error'?'evidence-error workspace-status':'evidence-status workspace-status'} role={phase==='error'?'alert':'status'} aria-busy={phase==='loading'||undefined}>
    {message}
    {onRetry&&(phase==='error'||phase==='empty')&&<button type="button" onClick={onRetry}>{status.retryLabel}</button>}
    {onCancel&&phase==='loading'&&<button type="button" onClick={onCancel}>{status.cancelLabel}</button>}
    {onOpenResult&&phase==='ready'&&<button type="button" onClick={onOpenResult}>{status.resultLabel}</button>}
  </div>;
}
