// ===== Utilities pane + sub-views (video, convert, upscale, ai-edit) =====

const { Field, Toggle, Seg, Select } = window.SettingsForms;

function UtilitiesIndex({ onOpen }){
  const tiles = [
    {
      k:'video', icon: I.cinema, status:'beta', label:'Beta',
      title:<>Cinema <em>Player</em></>,
      desc:'Auto-engages when a video file is loaded. Frame-accurate scrub, A/B loop, in/out marks.',
      features:['Reel-style playhead with film perforations','J·K·L shuttle keys','Cycle-through markers · keep / reject reels','Audio scrub at half-speed']
    },
    {
      k:'convert', icon: I.convert, status:'planned',
      title:<>File <em>Conversion</em></>,
      desc:'Batch transform format, container, and color space without leaving the suite.',
      features:['JPEG · PNG · WebP · AVIF · TIFF · HEIC','MP4 · MOV · MKV · WebM','Color-space convert (sRGB ⇄ DCI-P3 ⇄ Rec.2020)','Drop folder, mirror structure on output']
    },
    {
      k:'upscale', icon: I.upscale, status:'planned',
      title:<>Upscale <em>Studio</em></>,
      desc:'2× / 4× model-driven enhancement with grain preservation for vintage stocks.',
      features:['Real-ESRGAN · 4× (photo) · 4× (anime)','SwinIR · denoise + upscale','Preserve film grain · halation re-bake','GPU queue with checkpoint resume']
    },
    {
      k:'aivideo', icon: I.scissors, status:'planned',
      title:<>AI Video <em>Atelier</em></>,
      desc:'Cut, restyle, interpolate. Prompt-driven editing on the timeline.',
      features:['Prompt-to-cut & smart re-edit','Frame interpolation 24 → 60 fps','Style transfer (Kodachrome · Tri-X · 8mm)','Object track + remove · audio re-time']
    },
  ];

  return (
    <>
      <h2 className="section-title">Utilities <em>· suite tools</em></h2>
      <div className="section-sub">Modular utilities · click any tile to configure</div>

      <div className="util-grid">
        {tiles.map(t => (
          <div key={t.k} className="util-tile" onClick={()=>onOpen(t.k)}>
            <div className="util-icon"><t.icon/></div>
            <h3>{t.title}</h3>
            <div className="util-desc">{t.desc}</div>
            <div className="row-flex" style={{justifyContent:'space-between'}}>
              <span className={'util-status ' + (t.status||'planned')}>● {t.label || t.status}</span>
              <span className="mono" style={{fontSize:10, color:'var(--wine-3)', letterSpacing:'0.18em'}}>OPEN →</span>
            </div>
            <ul className="util-features">{t.features.map(f => <li key={f}>{f}</li>)}</ul>
          </div>
        ))}
      </div>

      <div style={{marginTop:22, padding:14, border:'1px dashed var(--line-1)', borderRadius:3, background:'rgba(0,0,0,0.25)'}}>
        <div className="mono" style={{fontSize:10, letterSpacing:'0.22em', color:'var(--wine-3)', textTransform:'uppercase', marginBottom:6}}>Roadmap</div>
        <div style={{fontSize:11, color:'var(--silver-3)', lineHeight:1.7}}>
          UI shells are in place; functionality is staged. Auto-detection routes video files
          to the Cinema Player without user input. Conversion and Upscale share the GPU queue.
        </div>
      </div>
    </>
  );
}

function VideoPane({ onBack }){
  return (
    <div className="sub-view">
      <button className="sub-back" onClick={onBack}><I.back/> Back to Utilities</button>
      <div>
        <h2 className="section-title">Cinema <em>Player</em></h2>
        <div className="section-sub">Auto-engaged on video file · frame-accurate</div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 240px', gap:14}}>
          <div>
            <div className="vplayer">
              <div className="frame-info"><span className="rec"></span>REEL · ROLL 03 · TAKE 12</div>
              <div className="frame-info-r">23.976 fps · 1080p · ProRes 422</div>
              <div className="play-orb"><I.play/></div>
              <div className="scanlines"></div>
            </div>
            <div className="vctrls">
              <div className="row-flex" style={{gap:4}}>
                <button className="dock-btn" style={{width:30,height:30}}><I.prev/></button>
                <button className="dock-btn" style={{width:30,height:30}}><I.play/></button>
                <button className="dock-btn" style={{width:30,height:30}}><I.next/></button>
              </div>
              <div className="vtrack">
                <div className="bar"><div className="fill"></div><div className="head"></div></div>
                <div className="marks">
                  <span style={{left:'12%'}}/><span style={{left:'25%'}}/><span style={{left:'46%'}}/>
                  <span style={{left:'58%'}}/><span style={{left:'72%'}}/><span style={{left:'88%'}}/>
                </div>
              </div>
              <div className="v-time"><span style={{color:'var(--wine-3)'}}>00:01:42</span><span className="dim"> / 00:04:28</span></div>
              <div className="row-flex" style={{gap:4}}>
                <button className="dock-btn" style={{width:30,height:30}}><I.vol/></button>
                <button className="dock-btn" style={{width:30,height:30}}><I.full/></button>
              </div>
            </div>
          </div>

          <div className="vside">
            <div className="card">
              <div className="mono" style={{fontSize:9, letterSpacing:'0.22em', color:'var(--silver-4)', textTransform:'uppercase', marginBottom:10}}>Markers</div>
              {[
                {t:'00:00:14', l:'Establishing'},
                {t:'00:00:42', l:'Cut · in'},
                {t:'00:01:18', l:'Slow zoom'},
                {t:'00:01:42', l:'KEEP', color:'#98c486'},
                {t:'00:02:55', l:'Cut · out'},
              ].map(m => (
                <div key={m.t} style={{display:'grid', gridTemplateColumns:'auto 1fr auto', gap:8, alignItems:'center', padding:'4px 0', borderBottom:'1px solid var(--line-1)', fontFamily:'var(--mono)', fontSize:10, color:'var(--silver-3)'}}>
                  <span style={{color:m.color||'var(--wine-3)'}}>{m.t}</span>
                  <span style={{color: m.color || 'var(--silver-2)', textTransform:'uppercase', letterSpacing:'0.1em'}}>{m.l}</span>
                  <I.x style={{width:11,height:11, color:'var(--text-mute)'}}/>
                </div>
              ))}
              <button className="btn ghost" style={{marginTop:10, width:'100%'}}><I.plus/> Mark at playhead</button>
            </div>
            <div className="card">
              <div className="mono" style={{fontSize:9, letterSpacing:'0.22em', color:'var(--silver-4)', textTransform:'uppercase', marginBottom:8}}>Auto-Switch</div>
              <Field label="Detect video files">
                <Toggle on={true}/>
              </Field>
              <Field label="A/B loop key">
                <span className="kbd wide">L</span>
              </Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConvertPane({ onBack }){
  const queue = [
    {n:'misc_series_001.heic', from:'HEIC', to:'JPEG · 95', pct:'100%'},
    {n:'misc_series_002.heic', from:'HEIC', to:'JPEG · 95', pct:'100%'},
    {n:'misc_series_003.heic', from:'HEIC', to:'JPEG · 95', pct:'68%'},
    {n:'reel_b_take07.mov', from:'MOV · ProRes', to:'MP4 · H.265', pct:'queued'},
    {n:'reel_b_take08.mov', from:'MOV · ProRes', to:'MP4 · H.265', pct:'queued'},
  ];
  return (
    <div className="sub-view">
      <button className="sub-back" onClick={onBack}><I.back/> Back to Utilities</button>
      <div>
        <h2 className="section-title">File <em>Conversion</em></h2>
        <div className="section-sub">Batch convert across formats · color spaces · containers</div>

        <div className="dropzone">
          <I.download style={{width:24, height:24, color:'var(--wine-3)'}}/>
          <div className="big">Drop files or folders here</div>
          <div className="small">or click to browse · 248 ready in source</div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, margin:'18px 0'}}>
          <div className="card">
            <div className="mono" style={{fontSize:9, letterSpacing:'0.22em', color:'var(--silver-4)', textTransform:'uppercase', marginBottom:10}}>Output</div>
            <Field label="Format">
              <Select value="JPEG" onChange={()=>{}} options={['JPEG','PNG','WebP','AVIF','TIFF','HEIC']}/>
            </Field>
            <Field label="Quality">
              <input type="range" className="slider" min="0" max="100" defaultValue="92" style={{'--p':'92%'}}/>
            </Field>
            <Field label="Color space">
              <Select value="sRGB" onChange={()=>{}} options={['sRGB','Adobe_RGB','DCI_P3','Rec.2020']}/>
            </Field>
          </div>
          <div className="card">
            <div className="mono" style={{fontSize:9, letterSpacing:'0.22em', color:'var(--silver-4)', textTransform:'uppercase', marginBottom:10}}>Transform</div>
            <Field label="Resize">
              <Seg value="none" onChange={()=>{}} options={[{v:'none',l:'None'},{v:'long',l:'Long Edge'},{v:'pct',l:'%'}]}/>
            </Field>
            <Field label="Strip metadata">
              <Toggle on={false}/>
            </Field>
            <Field label="Mirror folders">
              <Toggle on={true}/>
            </Field>
          </div>
        </div>

        <div className="convtable">
          <div className="row head">
            <div>File</div><div>From</div><div>To</div><div>Status</div>
          </div>
          {queue.map((q,i) => (
            <div key={i} className="row">
              <div>{q.n}</div>
              <div>{q.from}</div>
              <div><span className="arrow">→</span> {q.to}</div>
              <div className="pct">{q.pct}</div>
            </div>
          ))}
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:14}}>
          <button className="btn ghost">Clear queue</button>
          <button className="btn primary"><I.play/> Start batch</button>
        </div>
      </div>
    </div>
  );
}

function UpscalePane({ onBack }){
  return (
    <div className="sub-view">
      <button className="sub-back" onClick={onBack}><I.back/> Back to Utilities</button>
      <div>
        <h2 className="section-title">Upscale <em>Studio</em></h2>
        <div className="section-sub">Model-driven enhancement · 2× · 4× · grain-aware</div>

        <div className="compare">
          <div>
            <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}></div>
            <div className="label">Source · 1024 × 768</div>
          </div>
          <div>
            <div style={{position:'absolute', inset:0, background:'linear-gradient(90deg, rgba(74,14,33,0.2), transparent)'}}></div>
            <div className="label r">Output · 4096 × 3072 · 4×</div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, margin:'18px 0'}}>
          <div className="card">
            <div className="mono" style={{fontSize:9, letterSpacing:'0.22em', color:'var(--silver-4)', textTransform:'uppercase', marginBottom:10}}>Model</div>
            <Field label="Engine">
              <Select value="Real-ESRGAN_4x" onChange={()=>{}} options={['Real-ESRGAN_4x','Real-ESRGAN_4x_anime','SwinIR','HAT','LDSR']}/>
            </Field>
            <Field label="Scale">
              <Seg value="4" onChange={()=>{}} options={[{v:'2',l:'2×'},{v:'3',l:'3×'},{v:'4',l:'4×'}]}/>
            </Field>
            <Field label="Denoise">
              <input type="range" className="slider" min="0" max="100" defaultValue="35" style={{'--p':'35%'}}/>
            </Field>
            <Field label="Tile size">
              <Select value="512" onChange={()=>{}} options={['256','384','512','768','1024']}/>
            </Field>
          </div>
          <div className="card">
            <div className="mono" style={{fontSize:9, letterSpacing:'0.22em', color:'var(--silver-4)', textTransform:'uppercase', marginBottom:10}}>Grain & Filmic</div>
            <Field label="Preserve film grain">
              <Toggle on={true}/>
            </Field>
            <Field label="Re-bake halation" desc="Re-render bloom at output resolution after upscale">
              <Toggle on={true}/>
            </Field>
            <Field label="Match source filter">
              <Select value="Active_filter_(Kodachrome)" onChange={()=>{}} options={['Active_filter_(Kodachrome)','None','Tri-X 400','Velvia 50']}/>
            </Field>
          </div>
        </div>

        <div className="card" style={{marginBottom:14}}>
          <div style={{display:'flex', alignItems:'center', gap:14}}>
            <I.cpu style={{width:18, height:18, color:'var(--wine-3)'}}/>
            <div style={{flex:1}}>
              <div className="mono" style={{fontSize:10, letterSpacing:'0.18em', color:'var(--silver-2)', textTransform:'uppercase'}}>GPU Queue</div>
              <div style={{fontSize:11, color:'var(--text-3)', marginTop:2}}>3 frames upscaling · 12 queued · ETA 4m 22s</div>
            </div>
            <div style={{width:200}}>
              <div className="vtrack"><div className="bar"><div className="fill" style={{width:'22%'}}></div></div></div>
            </div>
            <button className="btn">Pause</button>
          </div>
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
          <button className="btn ghost">Add reference</button>
          <button className="btn primary"><I.upscale/> Run upscale</button>
        </div>
      </div>
    </div>
  );
}

function AIVideoPane({ onBack }){
  return (
    <div className="sub-view">
      <button className="sub-back" onClick={onBack}><I.back/> Back to Utilities</button>
      <div>
        <h2 className="section-title">AI Video <em>Atelier</em></h2>
        <div className="section-sub">Prompt-driven cut · style · interpolate</div>

        <div className="ai-prompt" style={{marginBottom:14}}>
          <textarea defaultValue="Cut the boring sections, push contrast, finish on the close-up at 02:14. Restyle in Kodachrome ’64 with halation."></textarea>
          <button className="send">Compose</button>
        </div>

        <div className="row-flex" style={{marginBottom:14}}>
          <span className="mono" style={{fontSize:9, color:'var(--text-mute)', letterSpacing:'0.18em', textTransform:'uppercase'}}>Recipes:</span>
          {['Tighten cuts','Color match','Re-time 60fps','Stabilize','Remove object','Match shot','B-roll fill'].map((r,i) => (
            <span key={r} className={'chip-tag' + (i===0?' on':'')}>{r}</span>
          ))}
        </div>

        <div className="timeline">
          <div className="ruler">
            {Array(10).fill(0).map((_,i) => <span key={i}>0:{(i*30).toString().padStart(2,'0')}</span>)}
          </div>
          <div className="tlrow">
            <span className="name">V1</span>
            <div className="track">
              <div className="clip" style={{left:'2%', width:'14%'}}>establishing</div>
              <div className="clip" style={{left:'18%', width:'22%'}}>roll · 03 · 12</div>
              <div className="clip" style={{left:'42%', width:'10%'}}>insert</div>
              <div className="clip" style={{left:'56%', width:'26%'}}>close-up · 02:14</div>
              <div className="clip" style={{left:'84%', width:'14%'}}>tail</div>
            </div>
          </div>
          <div className="tlrow">
            <span className="name">FX</span>
            <div className="track">
              <div className="clip fx" style={{left:'2%', width:'96%'}}>kodachrome · halation · grain 30</div>
            </div>
          </div>
          <div className="tlrow">
            <span className="name">A1</span>
            <div className="track">
              <div className="clip audio" style={{left:'2%', width:'40%'}}>dialogue</div>
              <div className="clip audio" style={{left:'44%', width:'54%'}}>score · re-timed</div>
            </div>
          </div>
          <div className="tlrow">
            <span className="name">A2</span>
            <div className="track">
              <div className="clip audio" style={{left:'18%', width:'8%'}}>foley</div>
              <div className="clip audio" style={{left:'56%', width:'14%'}}>foley</div>
            </div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:14}}>
          <div className="card">
            <div className="mono" style={{fontSize:9, letterSpacing:'0.22em', color:'var(--silver-4)', textTransform:'uppercase', marginBottom:10}}>Generation</div>
            <Field label="Model">
              <Select value="Composer_v2" onChange={()=>{}} options={['Composer_v2','Composer_v1','LumaCut','RunwayGen']}/>
            </Field>
            <Field label="Style strength">
              <input type="range" className="slider" min="0" max="100" defaultValue="68" style={{'--p':'68%'}}/>
            </Field>
            <Field label="Frame rate">
              <Seg value="24" onChange={()=>{}} options={[{v:'24',l:'24'},{v:'30',l:'30'},{v:'60',l:'60'}]}/>
            </Field>
          </div>
          <div className="card">
            <div className="mono" style={{fontSize:9, letterSpacing:'0.22em', color:'var(--silver-4)', textTransform:'uppercase', marginBottom:10}}>Output</div>
            <Field label="Resolution">
              <Select value="1920x1080" onChange={()=>{}} options={['1280x720','1920x1080','2560x1440','3840x2160']}/>
            </Field>
            <Field label="Render queue">
              <Seg value="local" onChange={()=>{}} options={[{v:'local',l:'Local GPU'},{v:'cloud',l:'Cloud'}]}/>
            </Field>
            <Field label="Auto-publish to Keep">
              <Toggle on={false}/>
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

window.UtilPanes = { UtilitiesIndex, VideoPane, ConvertPane, UpscalePane, AIVideoPane };
