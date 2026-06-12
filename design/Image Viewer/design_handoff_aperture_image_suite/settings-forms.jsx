// ===== Settings Modal — sections + tabs =====

function Field({ label, desc, children }){
  return (
    <div className="field">
      <div className="field-label">
        {label}
        {desc && <span className="desc">{desc}</span>}
      </div>
      <div className="field-control">{children}</div>
    </div>
  );
}

function Toggle({ on, onClick }){
  return <div className={'toggle' + (on?' on':'')} onClick={onClick}></div>;
}

function Seg({ value, onChange, options }){
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.v} className={value===o.v?'on':''} onClick={()=>onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

function Select({ value, onChange, options }){
  return (
    <div className="select">
      <select value={value} onChange={e=>onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
      </select>
    </div>
  );
}

const ACTIONS = ['keep','reject','next','previous','skip','disabled','random','zoom_in','zoom_out','fit_to_page','context_menu'];

function KeyRow({ label, kbd, mappings, onChange }){
  return (
    <div className="keyrow">
      <span className="kbd wide">{kbd}</span>
      <span style={{fontSize:11, color:'var(--silver-3)'}}>{label}</span>
      <Select value={mappings} onChange={onChange} options={ACTIONS}/>
      <button className="btn ghost" style={{padding:'4px 6px'}} title="Remove"><I.trash/></button>
    </div>
  );
}

function GeneralPane({ cfg, set }){
  return (
    <>
      <h2 className="section-title">General <em>· library & startup</em></h2>
      <div className="section-sub">Folders, watchers, default behavior</div>

      <Field label="Source Folder" desc="Where unsorted images live.">
        <div className="input-with-btn">
          <input className="input" defaultValue="C:/keepme_mainPC/Completed AI Artwork BDSM/a Misc Series"/>
          <button className="btn"><I.folder/> Browse</button>
        </div>
      </Field>

      <Field label="Keep Folder" desc="Destination for kept frames. Subfolder structure is preserved when recursive scan is on.">
        <div className="input-with-btn">
          <input className="input" defaultValue="C:/keepme_mainPC/parodies not uploaded yet/new new speedway"/>
          <button className="btn"><I.folder/> Browse</button>
        </div>
      </Field>

      <Field label="Reject Folder" desc="Optional — when set, rejected frames are moved instead of deleted.">
        <div className="input-with-btn">
          <input className="input" placeholder="(disabled — rejected files are removed)"/>
          <button className="btn"><I.folder/> Browse</button>
        </div>
      </Field>

      <Field label="Default App Mode" desc="Which set of input mappings load on launch.">
        <Seg value={cfg.appMode} onChange={v=>set({appMode:v})}
          options={[{v:'sort',l:'Sort'},{v:'view',l:'View'},{v:'last',l:'Last Used'}]}/>
      </Field>

      <Field label="Recursive Loading" desc="Scan subfolders. Folder hierarchy is mirrored on Keep.">
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <Toggle on={cfg.recursive} onClick={()=>set({recursive:!cfg.recursive})}/>
          <span className="mono" style={{fontSize:10, color:'var(--text-3)', letterSpacing:'0.18em', textTransform:'uppercase'}}>
            {cfg.recursive ? 'On — including 4 subfolders' : 'Off — flat scan'}
          </span>
        </div>
      </Field>

      <Field label="File Types" desc="Extensions included in the scan.">
        <div className="chipset">
          {['jpg','jpeg','png','webp','gif','tiff','bmp','heic','raw','cr2','nef','arw','dng'].map(t => (
            <span key={t} className={'chip-tag' + (['jpg','jpeg','png','webp','tiff','heic'].includes(t)?' on':'')}>.{t}</span>
          ))}
        </div>
      </Field>

      <Field label="Auto-advance" desc="Move forward after Keep / Reject without waiting.">
        <Toggle on={cfg.autoAdvance} onClick={()=>set({autoAdvance:!cfg.autoAdvance})}/>
      </Field>

      <Field label="Confirm Before Delete" desc="Prompt when reject folder is unset.">
        <Toggle on={cfg.confirmDelete} onClick={()=>set({confirmDelete:!cfg.confirmDelete})}/>
      </Field>
    </>
  );
}

function ControlsPane({ mode }){
  const isSort = mode==='sort';
  const buttons = [
    {label:'Left Click', kbd:'L·MOUSE', def: isSort?'keep':'next'},
    {label:'Right Click', kbd:'R·MOUSE', def: isSort?'reject':'context_menu'},
    {label:'Middle Click', kbd:'M·MOUSE', def: isSort?'disabled':'random'},
  ];
  const wheel = [
    {label:'Wheel Up', kbd:'WHEEL ↑', def:'previous'},
    {label:'Wheel Down', kbd:'WHEEL ↓', def:'next'},
  ];
  const keys = isSort ? [
    {label:'Random Image', kbd:'SPACE', def:'random'},
    {label:'Zoom In', kbd:'↑', def:'zoom_in'},
    {label:'Zoom Out', kbd:'↓', def:'zoom_out'},
    {label:'Fit to Page', kbd:'F', def:'fit_to_page'},
  ] : [
    {label:'Random Image', kbd:'SPACE', def:'random'},
    {label:'Zoom In', kbd:'↑', def:'zoom_in'},
    {label:'Zoom Out', kbd:'↓', def:'zoom_out'},
    {label:'Fit to Page', kbd:'F', def:'fit_to_page'},
  ];
  return (
    <>
      <h2 className="section-title">{isSort ? 'Sort' : 'View'} Mode <em>· controls</em></h2>
      <div className="section-sub">Mappings active when {isSort?'culling':'browsing'}. Edits apply live.</div>

      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <I.mouse style={{width:14, height:14, color:'var(--wine-3)'}}/>
          <span className="mono" style={{fontSize:10, letterSpacing:'0.22em', color:'var(--silver-3)', textTransform:'uppercase'}}>Mouse Buttons</span>
        </div>
        {buttons.map(b => <KeyRow key={b.label} {...b} mappings={b.def} onChange={()=>{}}/>)}
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <I.refresh style={{width:14, height:14, color:'var(--wine-3)'}}/>
          <span className="mono" style={{fontSize:10, letterSpacing:'0.22em', color:'var(--silver-3)', textTransform:'uppercase'}}>Wheel</span>
        </div>
        {wheel.map(b => <KeyRow key={b.label} {...b} mappings={b.def} onChange={()=>{}}/>)}
      </div>

      <div className="card">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <I.keyboard style={{width:14, height:14, color:'var(--wine-3)'}}/>
          <span className="mono" style={{fontSize:10, letterSpacing:'0.22em', color:'var(--silver-3)', textTransform:'uppercase'}}>Keys</span>
          <span className="mono" style={{marginLeft:'auto', fontSize:10, color:'var(--text-mute)'}}>4 active</span>
        </div>
        {keys.map(b => <KeyRow key={b.kbd} {...b} mappings={b.def} onChange={()=>{}}/>)}
        <div style={{paddingTop:12, borderTop:'1px dashed var(--line-1)', marginTop:8}}>
          <button className="btn ghost"><I.plus/> Add key binding</button>
        </div>
      </div>
    </>
  );
}

function FilmPane(){
  const filters = [
    {n:'None', m:'pass-through', cls:''},
    {n:'Kodachrome ’64', m:'warm · grain 30', cls:'f-kodachrome'},
    {n:'Velvia 50', m:'saturated red', cls:'f-velvia'},
    {n:'Tri-X 400', m:'noir · push +1', cls:'f-noir'},
    {n:'Cyanotype', m:'iron blue', cls:'f-cyanotype'},
    {n:'Platinum', m:'low-key sepia', cls:'f-platinum'},
    {n:'Halation', m:'red bloom edges', cls:''},
    {n:'8mm Reel', m:'gate weave + grain', cls:''},
    {n:'Chamber', m:'low-key portrait', cls:''},
  ];
  return (
    <>
      <h2 className="section-title">Filmography <em>· tone, grain, halation</em></h2>
      <div className="section-sub">Vintage film looks applied non-destructively to the viewport</div>

      <div className="filter-strip">
        {filters.map((f,i) => (
          <div key={f.n} className={'filter-cell' + (i===1?' active':'')}>
            <div className={'swatch ' + f.cls}></div>
            <div className="name">{f.n}</div>
            <div className="meta">{f.m}</div>
          </div>
        ))}
      </div>

      <Field label="Grain" desc="35mm-style monochrome noise overlay.">
        <input type="range" className="slider" min="0" max="100" defaultValue="32" style={{'--p':'32%'}}/>
      </Field>
      <Field label="Halation" desc="Red bloom around bright highlights — period film stock.">
        <input type="range" className="slider" min="0" max="100" defaultValue="58" style={{'--p':'58%'}}/>
      </Field>
      <Field label="Vignette" desc="Falloff at the edges of the frame.">
        <input type="range" className="slider" min="0" max="100" defaultValue="40" style={{'--p':'40%'}}/>
      </Field>
      <Field label="Color Cast" desc="Tonal shift across the entire image.">
        <Seg value="warm" onChange={()=>{}} options={[
          {v:'cool',l:'Cool'},{v:'neutral',l:'Neutral'},{v:'warm',l:'Warm'},{v:'wine',l:'Wine'}
        ]}/>
      </Field>
      <Field label="Letterbox" desc="Cinematic crop on display only.">
        <Seg value="off" onChange={()=>{}} options={[
          {v:'off',l:'Off'},{v:'1.85',l:'1.85'},{v:'2.39',l:'2.39'},{v:'4_3',l:'Academy 4:3'}
        ]}/>
      </Field>
      <Field label="Live preview while culling" desc="Apply during Sort mode — slower on huge files.">
        <Toggle on={true} onClick={()=>{}}/>
      </Field>
    </>
  );
}

function AppearancePane(){
  return (
    <>
      <h2 className="section-title">Appearance <em>· theme & atelier</em></h2>
      <div className="section-sub">Surface tones · type · density</div>

      <Field label="Theme" desc="Dark backgrounds only — color personality varies.">
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10}}>
          {[
            {n:'Burgundy', a:'#4a0e21', b:'#1c151f', active:true},
            {n:'Obsidian', a:'#3a3743', b:'#0c080d'},
            {n:'Plum', a:'#4a1a4a', b:'#160d18'},
            {n:'Iron', a:'#2a3038', b:'#0a0c10'},
          ].map(t => (
            <div key={t.n} style={{
              border: t.active?'1px solid var(--wine-3)':'1px solid var(--line-2)',
              padding:8, borderRadius:3,
              background:'var(--ink-0)',
              boxShadow: t.active?'0 0 12px rgba(168,45,68,0.3)':'none',
              cursor:'pointer'
            }}>
              <div style={{height:40, display:'flex'}}>
                <div style={{flex:1, background:t.a}}></div>
                <div style={{flex:2, background:t.b}}></div>
                <div style={{flex:1, background:'#d8d6d2', opacity:0.85}}></div>
              </div>
              <div className="mono" style={{fontSize:9, letterSpacing:'0.18em', textTransform:'uppercase', marginTop:6, color: t.active?'var(--wine-3)':'var(--silver-3)'}}>{t.n}</div>
            </div>
          ))}
        </div>
      </Field>

      <Field label="Accent" desc="Highlights, sliders, focus rings.">
        <div className="row-flex">
          {['#a82d44','#8a1f33','#6b1828','#b8956a','#c4c4c8'].map((c,i)=>(
            <div key={c} style={{
              width:28, height:28, borderRadius:'50%',
              background: c,
              border: i===0?'2px solid var(--silver-1)':'1px solid var(--line-2)',
              boxShadow: i===0?'0 0 0 2px rgba(168,45,68,0.4)':'inset 0 1px 0 rgba(255,255,255,0.1)',
              cursor:'pointer'
            }}></div>
          ))}
        </div>
      </Field>

      <Field label="Display Font" desc="Used for headings and emphasis.">
        <Select value="Cormorant_Garamond" onChange={()=>{}} options={['Cormorant_Garamond','Playfair_Display','EB_Garamond','Cinzel']}/>
      </Field>
      <Field label="UI Font" desc="Body text and controls.">
        <Select value="Inter" onChange={()=>{}} options={['Inter','IBM_Plex_Sans','Helvetica_Neue','System_Default']}/>
      </Field>

      <Field label="Density" desc="Spacing of inspector and lists.">
        <Seg value="comfortable" onChange={()=>{}} options={[
          {v:'compact',l:'Compact'},{v:'comfortable',l:'Comfortable'},{v:'spacious',l:'Spacious'}
        ]}/>
      </Field>

      <Field label="Film Grain on Chrome" desc="Subtle noise overlay across the whole interface.">
        <Toggle on={true} onClick={()=>{}}/>
      </Field>

      <Field label="Show Aperture Marks" desc="Corner brackets around the canvas.">
        <Toggle on={true} onClick={()=>{}}/>
      </Field>

      <Field label="Brushed Metal Hardware" desc="Knurled edges on dock and toggles.">
        <Toggle on={false} onClick={()=>{}}/>
      </Field>
    </>
  );
}

window.SettingsForms = { Field, Toggle, Seg, Select, KeyRow, GeneralPane, ControlsPane, FilmPane, AppearancePane };
