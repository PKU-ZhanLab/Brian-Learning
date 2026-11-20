import React, {useEffect, useState} from 'react';
import ROICompare from '../../src/components/ROICompare.jsx';
import {makeAtlasRegionRef} from '../../src/lib/atlas-identity.js';
import {MAIN_MANIFEST_RESOURCE, resourceValue, retry, getResourceState} from '../../src/lib/atlas-resource.js';
import {atlasResourceKeyFor} from '../../src/lib/volume.js';
import {replaceCustomVolumes} from '../../src/lib/custom-volumes.js';
import {prepareLocalVolumeProvenance} from '../../src/lib/computation-manifest.js';
import {exportNifti} from '../../src/lib/nifti.js';

const initial = {aAtlas:'dk', aLabels:[2,3], bAtlas:'ba-histology', bLabels:[14], computed:false, snapshot:'none'};

export function RetryManifestFixture() {
  const [manifest, setManifest] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    resourceValue(MAIN_MANIFEST_RESOURCE).then(setManifest).catch(() => setFailed(true));
  }, []);
  async function recover() {
    await retry(MAIN_MANIFEST_RESOURCE);
    const value = await resourceValue(MAIN_MANIFEST_RESOURCE);
    window.__x8SourceGenerations = ['dk','ba-histology'].map(id =>
      getResourceState(atlasResourceKeyFor(value.atlases[id], id)).generation);
    setManifest(value);
    setFailed(false);
  }
  return <>
    {failed && <button onClick={recover}>Retry manifest fixture</button>}
    <ROICompare language="en" manifest={manifest} initialState={initial}
      workspaceProjectId="X8-mounted" workspaceEpoch={0} onStateChange={state => { window.__x8MountedROI = state; }}/>
  </>;
}

async function loadUnresolvedOperands() {
  const manifest = await (await fetch('/data/manifest.json')).json();
  const a = makeAtlasRegionRef('aal-registered', manifest.atlases['aal-registered'], 8121);
  const b = makeAtlasRegionRef('aal3-registered', manifest.atlases['aal3-registered'], 87);
  const id = 'custom-s2-threshold-fixture';
  const volume = {
    id, data:Float32Array.of(1), shape:[1,1,1], affine:[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
    space:'MNI152NLin6Asym', order:'x-fastest', kind:'statistic', name:'Threshold fixture',
    canOverlayOnTarget:true, alignmentStatus:'user-declared', provenance:'Synthetic aligned fixture'
  };
  replaceCustomVolumes('S2-fixture', [await prepareLocalVolumeProvenance(volume, exportNifti(volume), {id})]);
  const selection = {
    aAtlas:'aal-registered', aLabels:[8121], aRegionRefs:[{...a,atlasVersion:'saved-unavailable-version'}],
    bAtlas:'aal3-registered', bLabels:[87], bRegionRefs:[b], resolutionMm:2, computed:false
  };
  return {manifest, initialState: selection};
}

export function UnresolvedROIFixture() {
  const [operands, setOperands] = useState(null);
  useEffect(() => { loadUnresolvedOperands().then(setOperands); }, []);
  return operands && <div data-s2-roi-fixture="">
    <ROICompare {...operands} language="en" workspaceProjectId="S2-fixture" workspaceEpoch={0}
      onStateChange={state => { window.__s2ROIState = state; }}/>
  </div>;
}
