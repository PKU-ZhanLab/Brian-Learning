"""Fetch authored public anatomy data; run only in the existing mne environment.

Source bytes and SHA256 receipts are retained. No retrieved code is executed.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse
import hashlib
import json
import urllib.request
import time

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data-sources' / 'anatomy'
RAW.mkdir(parents=True, exist_ok=True)
PAM_COMMIT = '609a18235d9143dad0d6bf5bb35e2bff9e55196f'

def fetch(url, target):
    path = RAW / target
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'NeuroAtlas-educational-data-builder'})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=120) as source, path.with_suffix(path.suffix + '.part').open('wb') as output:
                    while chunk := source.read(1024 * 1024): output.write(chunk)
                path.with_suffix(path.suffix + '.part').replace(path)
                break
            except Exception:
                if attempt == 2: raise
                time.sleep(1 + attempt)
    receipt = {'url': url, 'file': target, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    (path.parent / (path.name + '.source.json')).write_text(json.dumps(receipt, indent=2), encoding='utf8')
    print(json.dumps(receipt), flush=True)
    return path

def inspect():
    for repo, branch, filename in [('spinalcordtoolbox/PAM50', 'master', 'pam-tree.json'), ('IPIS-XieLei/CNsAtlas', 'main', 'cn-tree.json')]:
        path = fetch(f'https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1', filename)
        data = json.loads(path.read_text())
        print(repo, 'commit', data['sha'], 'file count', len(data['tree']))
        if 'CNsAtlas' in repo:
            print(json.dumps([row for row in data['tree'] if 'LICENSE' in row['path'].upper() or ('anatomical_tracts' in row['path'] and row['path'].endswith('.vtp'))], ensure_ascii=True)[:5000])
    data = json.loads(fetch('https://api.github.com/repos/data-others/atlas/releases/tags/hcp1065', 'hcp-release.json').read_text())
    print(json.dumps([{'name': row['name'], 'size': row['size'], 'url': row['browser_download_url']} for row in data['assets']], indent=2))
    fetch('https://raw.githubusercontent.com/spinalcordtoolbox/spinalcordtoolbox/master/LICENSE', 'sct-LICENSE.txt')
    fetch('https://raw.githubusercontent.com/spinalcordtoolbox/PAM50/' + PAM_COMMIT + '/README.md', 'pam-README.md')
    fetch('https://raw.githubusercontent.com/spinalcordtoolbox/PAM50/' + PAM_COMMIT + '/CHANGES.md', 'pam-CHANGES.md')

def pam():
    names = ['template/PAM50_cord.nii.gz', 'template/PAM50_gm.nii.gz', 'template/PAM50_wm.nii.gz', 'template/PAM50_spinal_levels.nii.gz', 'template/PAM50_rootlets.nii.gz', 'template/info_label.txt', 'atlas/info_label.txt']
    names += [f'atlas/PAM50_atlas_{i:02}.nii.gz' for i in range(30, 36)]
    def one(name): return fetch(f'https://raw.githubusercontent.com/spinalcordtoolbox/PAM50/{PAM_COMMIT}/{name}', 'pam50/' + name)
    with ThreadPoolExecutor(max_workers=4) as pool: list(pool.map(one, names))

def hcp():
    release = json.loads((RAW/'hcp-release.json').read_text())
    entry = next(row for row in release['assets'] if row['name'] == 'hcp1065_avg_tracts_trk.zip')
    fetch(entry['browser_download_url'], 'hcp1065_avg_tracts_trk.zip')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('phase', choices=['inspect', 'pam', 'hcp']); args = parser.parse_args()
    globals()[args.phase]()
