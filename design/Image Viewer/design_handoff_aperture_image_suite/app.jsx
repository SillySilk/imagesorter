// Settings modal shell — orchestrates tabs and panes

const { useState } = React;
const { GeneralPane, ControlsPane, FilmPane, AppearancePane } = window.SettingsForms;
const { UtilitiesIndex, VideoPane, ConvertPane, UpscalePane, AIVideoPane } = window.UtilPanes;

function SettingsModal({ onClose, initialTab='general' }){
  const [tab, setTab] = useState(initialTab);
  const [util, setUtil] = useState(null);
  const [cfg, setCfg] = useState({
    appMode: 'view', recursive: true, autoAdvance: true, confirmDelete: true,
  });
  const set = (patch) => setCfg(c => ({...c, ...patch}));

  const tabs = [
    { group:'Library' },
    { k:'general', icon: I.folder, l:'General' },
    { k:'sort', icon: I.aperture, l:'Sort Mode' },
    { k:'view', icon: I.layers, l:'View Mode' },
    { group:'Atelier' },
    { k:'film', icon: I.film, l:'Filmography', count: '9' },
    { k:'appearance', icon: I.palette, l:'Appearance' },
    { group:'Suite' },
    { k:'utils', icon: I.cpu, l:'Utilities', count: '4' },
    { k:'about', icon: I.info, l:'About' },
  ];

  let pane;
  if (tab==='general') pane = <GeneralPane cfg={cfg} set={set}/>;
  else if (tab==='sort') pane = <ControlsPane mode="sort"/>;
  else if (tab==='view') pane = <ControlsPane mode="view"/>;
  else if (tab==='film') pane = <FilmPane/>;
  else if (tab==='appearance') pane = <AppearancePane/>;
  else if (tab==='utils') {
    if (util==='video') pane = <VideoPane onBack={()=>setUtil(null)}/>;
    else if (util==='convert') pane = <ConvertPane onBack={()=>setUtil(null)}/>;
    else if (util==='upscale') pane = <UpscalePane onBack={()=>setUtil(null)}/>;
    else if (util==='aivideo') pane = <AIVideoPane onBack={()=>setUtil(null)}/>;
    else pane = <UtilitiesIndex onOpen={setUtil}/>;
  }
  else if (tab==='about') pane = (
    <>
      <h2 className="section-title">About <em>Aperture</em></h2>
      <div className="section-sub">Version 0.7.0 · build 248</div>
      <div className="card" style={{marginBottom:14}}>
        <div className="serif" style={{fontSize:24, color:'var(--cream)', fontStyle:'italic', marginBottom:6}}>“A patient eye, a sharper cut.”</div>
        <div style={{fontSize:11, color:'var(--silver-3)', lineHeight:1.7, maxWidth: 520}}>
          Aperture is a private image suite for rapid culling, archival viewing,
          and downstream processing. Designed for very large libraries and
          deliberate selection.
        </div>
      </div>
      <div className="kv"><span className="k">version</span><span className="v">0.7.0 · 2026·05·06</span></div>
      <div className="kv"><span className="k">runtime</span><span className="v">Python 3.12 · Tk 8.6</span></div>
      <div className="kv"><span className="k">gpu</span><span className="v">CUDA 12.4 · 1 device</span></div>
      <div className="kv"><span className="k">config</span><span className="v">~/.aperture/culler_settings.json</span></div>
    </>
  );

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-orn tl" style={{color:'var(--wine-3)'}}><DecoCorner/></div>
        <div className="modal-orn tr" style={{color:'var(--wine-3)'}}><DecoCorner/></div>
        <div className="modal-orn bl" style={{color:'var(--wine-3)'}}><DecoCorner/></div>
        <div className="modal-orn br" style={{color:'var(--wine-3)'}}><DecoCorner/></div>

        <div className="modal-header">
          <div className="modal-title">
            <span className="eyebrow">◆ Preferences</span>
            <h2>Aperture <em>· settings</em></h2>
          </div>
          <button className="modal-close" onClick={onClose}><I.x/></button>
        </div>

        <div className="modal-body">
          <nav className="modal-tabs">
            {tabs.map((t,i) => t.group ? (
              <div key={'g'+i} className="group">{t.group}</div>
            ) : (
              <button key={t.k} className={'tab-item' + (tab===t.k?' active':'')} onClick={()=>{ setTab(t.k); setUtil(null); }}>
                <t.icon/>
                <span>{t.l}</span>
                {t.count && <span className="count">{t.count}</span>}
              </button>
            ))}
          </nav>
          <div className="modal-content">{pane}</div>
        </div>

        <div className="modal-footer">
          <span className="footer-meta">◇ All edits apply live · ⌘S writes to disk</span>
          <span className="grow"></span>
          <button className="btn ghost"><I.refresh/> Reset to defaults</button>
          <button className="btn">Cancel</button>
          <button className="btn primary"><I.check/> Save</button>
        </div>
      </div>
    </div>
  );
}

// ===== root =====

function App(){
  const [openSettings, setOpenSettings] = useState(false);
  const [rail, setRail] = useState('sort');
  const [mode, setMode] = useState('sort');
  const [loaded, setLoaded] = useState(true);

  return (
    <div className="app grain leather">
      <TitleBar onOpenSettings={()=>setOpenSettings(true)} mode={mode} setMode={setMode}/>
      <Rail active={rail} setActive={setRail} onOpenSettings={()=>setOpenSettings(true)}/>
      <div className="main">
        <Canvas mode={mode} loaded={loaded} onToggleLoaded={()=>setLoaded(l=>!l)}/>
        <Inspector/>
      </div>
      <StatusBar mode={mode}/>
      {openSettings && <SettingsModal onClose={()=>setOpenSettings(false)}/>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
