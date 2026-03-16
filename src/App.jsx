import { useState, useMemo } from "react";

const PRODUTOS = [
  {id:"pos-mao", ncm:"8470.50.10",nome:"Terminal de Pagamento - MAO",   uf:"AM",ipi:0,    pcBase:"zmf", icms:12,cred:12,mva:0,  aliqST:0,  fti:0  },
  {id:"nb12-mao",ncm:"8471.30.12",nome:'Notebook/Tablet 8"-14" - MAO',  uf:"AM",ipi:0,    pcBase:"zmf", icms:12,cred:12,mva:35, aliqST:19, fti:0  },
  {id:"nb19-mao",ncm:"8471.30.19",nome:'Notebook/Tablet 15"+ - MAO',    uf:"AM",ipi:0,    pcBase:"zmf", icms:12,cred:12,mva:35, aliqST:19, fti:0  },
  {id:"cpu-mao", ncm:"8471.50.10",nome:"CPU Peq. Capac. - MAO",         uf:"AM",ipi:0,    pcBase:"zmf", icms:12,cred:12,mva:35, aliqST:19, fti:0  },
  {id:"smt-mao", ncm:"8517.13.00",nome:"Smartphone - MAO",              uf:"AM",ipi:0,    pcBase:"zmf", icms:12,cred:12,mva:25, aliqST:19, fti:2.2},
  {id:"cam-mao", ncm:"8525.89.29",nome:"Smart Camera WiFi - MAO",       uf:"AM",ipi:0,    pcBase:"zmf", icms:12,cred:12,mva:35, aliqST:19, fti:2.2},
  {id:"mon-mao", ncm:"8528.52.00",nome:"Monitor PPB MAO - MAO",         uf:"AM",ipi:0,    pcBase:"zmf", icms:12,cred:12,mva:25, aliqST:19, fti:0  },
  {id:"mon3-mao",ncm:"8528.52.00",nome:"Monitor 3o PPB fora ZFM - MAO", uf:"AM",ipi:0,    pcBase:9.25,  icms:12,cred:0, mva:25, aliqST:19, fti:0  },
  {id:"kbd-mao", ncm:"8471.60.52",nome:"Teclado Imp. Direta - MAO",     uf:"AM",ipi:9.75, pcBase:9.25,  icms:4, cred:3, mva:35, aliqST:19, fti:0  },
  {id:"nb12-ios",ncm:"8471.30.12",nome:'Notebook/Tablet 8"-14" - IOS',  uf:"BA",ipi:15,   pcBase:9.25,  icms:12,cred:12,mva:35, aliqST:19, fti:0  },
  {id:"nb19-ios",ncm:"8471.30.19",nome:'Notebook/Tablet 15"+ - IOS',    uf:"BA",ipi:15,   pcBase:9.25,  icms:12,cred:12,mva:35, aliqST:19, fti:0  },
  {id:"aio-ios", ncm:"8471.49.00",nome:"All In One / Servidor - IOS",   uf:"BA",ipi:9.75, pcBase:9.25,  icms:12,cred:12,mva:35, aliqST:19, fti:0  },
  {id:"smt-ios", ncm:"8517.13.00",nome:"Smartphone - IOS",              uf:"BA",ipi:15,   pcBase:9.25,  icms:12,cred:12,mva:25, aliqST:19, fti:0  },
  {id:"mon-ios", ncm:"8528.52.00",nome:"Monitor - IOS",                 uf:"BA",ipi:0,    pcBase:9.25,  icms:12,cred:12,mva:25, aliqST:19, fti:0  },
  {id:"smt-cwb", ncm:"8517.13.00",nome:"Smartphone - CWB",              uf:"PR",ipi:15,   pcBase:9.25,  icms:4, cred:4, mva:25, aliqST:19, fti:0  },
  {id:"fp-cwb",  ncm:"8517.14.31",nome:"Feature Phone (linha P) - CWB", uf:"PR",ipi:11.25,pcBase:9.25,  icms:4, cred:4, mva:25, aliqST:19, fti:0  },
  {id:"vpc-cwb", ncm:"8517.62.77",nome:"Smart Video Porteiro - CWB",    uf:"PR",ipi:15,   pcBase:9.25,  icms:7, cred:0, mva:37, aliqST:19, fti:0  },
  {id:"tab-cwb", ncm:"8471.30.11",nome:'Tablet 7" - CWB',               uf:"PR",ipi:15,   pcBase:9.25,  icms:7, cred:7, mva:35, aliqST:19, fti:0  },
  {id:"gw-cwb",  ncm:"8517.62.94",nome:"Smart Central/Gateway - CWB",   uf:"PR",ipi:9.75, pcBase:9.25,  icms:4, cred:4, mva:35, aliqST:19, fti:0  },
  {id:"spk-cwb", ncm:"8518.22.00",nome:"Caixa de Som Bluetooth - CWB",  uf:"PR",ipi:15,   pcBase:9.25,  icms:4, cred:0, mva:35, aliqST:19, fti:0  },
  {id:"spg-cwb", ncm:"8536.50.90",nome:"Smart Plug WiFi (Ex03) - CWB",  uf:"PR",ipi:3.25, pcBase:9.25,  icms:7, cred:0, mva:38, aliqST:19, fti:0  },
  {id:"chr-cwb", ncm:"8504.40.10",nome:"Carregador Celular - CWB",      uf:"PR",ipi:5,    pcBase:9.25,  icms:4, cred:0, mva:50, aliqST:19, fti:0  },
  {id:"lmp-cwb", ncm:"8539.52.00",nome:"Smart Lampada WiFi - CWB",      uf:"PR",ipi:6.5,  pcBase:9.25,  icms:4, cred:0, mva:63.67,aliqST:19,fti:0 },
  {id:"rob-cwb", ncm:"8508.11.00",nome:"Smart Robo Aspirador - CWB",    uf:"PR",ipi:6.5,  pcBase:9.25,  icms:4, cred:0, mva:35, aliqST:19, fti:0  },
  {id:"tot-cwb", ncm:"8471.60.80",nome:"Totem - CWB",                   uf:"PR",ipi:9.75, pcBase:9.25,  icms:7, cred:0, mva:0,  aliqST:0,  fti:0  },
  {id:"rtr-cwb", ncm:"8517.62.41",nome:"Router Mesh - CWB",             uf:"PR",ipi:15,   pcBase:9.25,  icms:4, cred:0, mva:35, aliqST:19, fti:0  },
];

const PC_ZFM = [
  {k:"dentro_zmf",   label:"Comprador dentro da ZFM",pct:0,
   sub:"PJ ou PF nos municipios de Manaus, Pres. Figueiredo ou Rio Preto da Eva.",
   base:"Despacho MF S/N de 13.11.2017 / Parecer PGFN 1743/2016"},
  {k:"nao_cumulativo",label:"Lucro Real (100% nao-cumulativo)",pct:3.65,
   sub:"PJ fora da ZFM com 100% das receitas no regime nao-cumulativo.",
   base:"Lei 10.637/02, art. 2o, par.4o, I,b | Lei 10.833/03, art. 2o, par.5o, I,b"},
  {k:"cumulativo",   label:"Lucro Presumido / Simples / Misto / Orgao Publico",pct:7.30,
   sub:"Lucro Presumido, Simples Nacional, Lucro Real parcial e adm. publica.",
   base:"Lei 10.637/02, art. 2o, par.4o, II | Lei 10.833/03, art. 2o, par.5o"},
  {k:"outros",       label:"ONG / Entidade sem fins lucrativos / PF",pct:9.25,
   sub:"Sistema S (Sesi, Senai), APAE, APM, pessoa fisica fora da ZFM.",
   base:"Lei 10.637/02, art. 2o, caput | Lei 10.833/03, art. 2o, caput"},
];

const UFS=["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const MX={
  AC:[19,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  AL:[12,21.5,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  AM:[12,12,20,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  AP:[12,12,12,18,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  BA:[12,12,12,12,20.5,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  CE:[12,12,12,12,12,20,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  DF:[12,12,12,12,12,12,20,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  ES:[12,12,12,12,12,12,12,17,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  GO:[12,12,12,12,12,12,12,12,19,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  MA:[12,12,12,12,12,12,12,12,12,23,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  MG:[7,7,7,7,7,7,7,7,7,7,18,7,7,7,7,7,7,12,12,7,7,7,12,12,7,12,7],
  MS:[12,12,12,12,12,12,12,12,12,12,12,17,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  MT:[12,12,12,12,12,12,12,12,12,12,12,12,17,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  PA:[12,12,12,12,12,12,12,12,12,12,12,12,12,19,12,12,12,12,12,12,12,12,12,12,12,12,12],
  PB:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,20,12,12,12,12,12,12,12,12,12,12,12,12],
  PE:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20.5,12,12,12,12,12,12,12,12,12,12,12],
  PI:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,22.5,12,12,12,12,12,12,12,12,12,12],
  PR:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,19.5,12,7,7,7,12,12,7,12,7],
  RJ:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,12,22,7,7,7,12,12,7,12,7],
  RN:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20,12,12,12,12,12,12,12],
  RO:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,19.5,12,12,12,12,12,12],
  RR:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20,12,12,12,12,12],
  RS:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,12,12,7,7,7,17,12,7,12,7],
  SC:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,12,12,7,7,7,12,17,12,12,7],
  SE:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20,12,12],
  SP:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,12,12,7,7,7,12,12,7,18,7],
  TO:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20],
};
const ALIQ_INT={AC:19,AL:21.5,AM:20,AP:18,BA:20.5,CE:20,DF:20,ES:17,GO:19,MA:23,MG:18,MS:17,MT:17,PA:19,PB:20,PE:20.5,PI:22.5,PR:19.5,RJ:22,RN:20,RO:19.5,RR:20,RS:17,SC:17,SE:20,SP:18,TO:20};
const FCP={AL:1,MG:1,RJ:2,SE:1};
const getICMS=(o,d)=>{if(o===d)return ALIQ_INT[o]||18;const r=MX[o],i=UFS.indexOf(d);return(r&&i>=0)?r[i]:12;};

const PPB_ITEMS=[
  {id:"injecao",label:"Injecao Plastica"},{id:"bateria",label:"Bateria"},
  {id:"carregador",label:"Carregador"},{id:"memoria",label:"Memoria"},
  {id:"cabo",label:"Cabo"},{id:"placa",label:"Producao da Placa (PCB)"},
];

const brl=v=>(!isFinite(v)||isNaN(v))?"":v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const usd=v=>(!isFinite(v)||isNaN(v))?"":"USD "+v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=v=>`${(+v||0).toFixed(3).replace(/\.?0+$/,"").replace(".",",")}%`;
const n3=v=>(+v||0).toFixed(3).replace(/\.?0+$/,"").replace(".",",");
const parse=s=>parseFloat(String(s).replace(",","."))||0;

const DEF={
  prodId:"pos-mao",pcZfmKey:"nao_cumulativo",regimeVendedor:"real",
  tipoComprador:"contrib",destinacaoCliente:"revenda",ufDestino:"SP",
  fobUSD:60,freteUSD:5,ptax:5.70,seguroBRL:2,aliqII:4.19,
  despesas:1.1,despesasPct:1.1,despesasModo:"pct",
  cfImp:0,cra:0,
  ppbAtivos:{injecao:false,bateria:false,carregador:false,memoria:false,cabo:false,placa:false},
  ppbVals:{injecao:0,bateria:0,carregador:0,memoria:0,cabo:0,placa:0},
  producao:38.5,garantia:21.27,bkpPct:2,outrosBRL:6.8,ftiAtivo:true,
  pd:3.47,cfixo:4.63,scrap:0.91,royal:1.27,cfVenda:2.11,frete:0.80,
  comis:0.15,comisX:0.10,mkt:0,rebate:0,margem:5,
  stAtivo:false,mva:0,icmsDestST:18,precoAlvo:0,
  moedaCusto:"BRL",
};

const CALC_DEF={
  frete:{sUSD:0,aUSD:0,saUSD:0,pS:100,pA:0,pSA:0,applied:false},
  cfImp:{tr:30,pp:-30,tx:0.8,applied:false},
  pcb:{tl:0,vol:1000,tempo:0,pctFob:0},
  cfVenda:{prazo:30,taxa:1.14,applied:false},
};

// ── Storage de Registros ──────────────────────────────────────────────────────
const STORAGE_KEY = "positec_calc_registros";
const loadRegistros = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch { return []; } };
const saveRegistros = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

// ── NInput ────────────────────────────────────────────────────────────────────
function NInput({value,onChange,readOnly,width=80}){
  const [raw,setRaw]=useState(String(value).replace(".",","));
  const [lastProp,setLastProp]=useState(value);
  const [focused,setFocused]=useState(false);
  // Sincroniza raw quando value muda externamente (calculadora PCB, frete, etc.)
  if(!focused&&value!==lastProp){
    setLastProp(value);
    setRaw(String(+value||0).replace(".",","));
  }
  const shown=readOnly?String(+value||0).replace(".",","):raw;
  return(
    <input type="text" inputMode="decimal" value={shown} readOnly={!!readOnly}
      style={{background:"none",border:"none",outline:"none",fontFamily:"'DM Mono',monospace",
        fontSize:11,fontWeight:500,color:"#f1f5f9",padding:"5px 8px",width,textAlign:"right"}}
      onFocus={()=>setFocused(true)}
      onChange={e=>{
        if(readOnly)return;
        const v=e.target.value;
        if(/^-?\d*[,.]?\d{0,3}$/.test(v)||v===""||v==="-"){setRaw(v);onChange(parse(v));}
      }}
      onBlur={()=>{setFocused(false);if(!readOnly){const n=parse(raw);setRaw(String(n).replace(".",","));}}}
    />
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({label,value,onChange,sfx="",hint,note,readOnly,action,locked,onUnlock}){
  const isRO=readOnly||locked;
  return(
    <div style={{display:"flex",alignItems:"flex-start",gap:8,justifyContent:"space-between"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{fontSize:12,fontWeight:600,color:"#dce7f7",letterSpacing:".3px"}}>{label}</span>
        {hint&&<span style={{fontSize:10,color:"#7a90b0",fontFamily:"'DM Mono',monospace"}}>{hint}</span>}
        {note&&<span style={{fontSize:10,color:"#f87171",fontFamily:"'DM Mono',monospace"}}>{note}</span>}
      </div>
      <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
        <div className={`fw ${isRO?"fro":""} ${locked?"flocked":""}`}>
          {sfx&&<span className="fpre">{sfx}</span>}
          <NInput value={value} onChange={onChange||(()=>{})} readOnly={isRO}/>
        </div>
        {locked&&onUnlock&&(
          <button className="cbtn cunlock" title="Desvincular calculadora — editar manualmente" onClick={onUnlock}>↩</button>
        )}
        {action}
      </div>
    </div>
  );
}

function RG({label,val,onChange,opts}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<div style={{fontSize:12,fontWeight:600,color:"#dce7f7",letterSpacing:".3px"}}>{label}</div>}
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {opts.map(o=><button key={o.v} className={`rgb ${val===o.v?"on":""}`} onClick={()=>onChange(o.v)}>{o.l}</button>)}
      </div>
    </div>
  );
}
function Tog({label,val,onChange,hint}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontWeight:600,color:"#dce7f7",letterSpacing:".3px"}}>{label}</div>
        {hint&&<div style={{fontSize:10,color:"#7a90b0",fontFamily:"'DM Mono',monospace"}}>{hint}</div>}
      </div>
      <button className={`tog ${val?"on":""}`} onClick={()=>onChange(!val)}><span className="tknob"/></button>
    </div>
  );
}
function Box({children,t="warn"}){return <div className={`ib ${t}`}>{children}</div>;}
function DR({label,value,accent,bold,sep}){
  return(
    <div className={`dr ${bold?"drb":""} ${sep?"drs":""} ${accent||""}`}>
      <span>{label}</span><span className="dv">{value}</span>
    </div>
  );
}
function WF({label,val,total,color,isT,sub}){
  const p=total>0?(Math.abs(val)/total)*100:0;
  return(
    <div className={`wfr ${isT?"wft":""} ${sub?"wfs":""}`}>
      <span className="wfl">{label}</span>
      <div className="wftr"><div className="wff" style={{width:`${Math.min(100,p)}%`,background:color}}/></div>
      <span className="wfp">{pct(p)}</span>
      <span className="wfv">{brl(val)}</span>
    </div>
  );
}
function Sec({title,tag,children,hl}){
  return(
    <div className={`sec ${hl?"hl":""}`}>
      <div className="sech">
        <span className="sect">{title}</span>
        {tag&&<span className="sectag">{tag}</span>}
      </div>
      <div className="secb">{children}</div>
    </div>
  );
}
function MI({val,onChange,sfx="USD",width=60}){
  const [r,setR]=useState(String(val).replace(".",","));
  return(
    <div className="fw" style={{minWidth:88}}>
      <span className="fpre">{sfx}</span>
      <input type="text" inputMode="decimal" value={r}
        style={{background:"none",border:"none",outline:"none",fontFamily:"'DM Mono',monospace",
          fontSize:11,fontWeight:500,color:"#f1f5f9",padding:"5px 6px",width,textAlign:"right"}}
        onChange={e=>{const v=e.target.value;if(/^-?\d*[,.]?\d{0,3}$/.test(v)||v===""){setR(v);onChange(parse(v));}}}
        onBlur={()=>{const n=parse(r);setR(String(n).replace(".",","));}}/>
    </div>
  );
}

// ── Modal CF Importação ───────────────────────────────────────────────────────
// Formula: FOB * ((1+taxa_mensal)^(dias/30) - 1)
// taxa em % a.m. (ex: 0,8% a.m.)  |  prazo negativo = antecipacao
function ModalCF({onClose,onApply,fobUSD,ptax,data,setData}){
  const dias=data.tr+data.pp;
  const cfFactor=Math.pow(1+data.tx/100,dias/30)-1;
  const cfUSD=fobUSD*cfFactor;
  const cfBRL=cfUSD*ptax;
  return(
    <div className="ov">
      <div className="mb" onClick={e=>e.stopPropagation()}>
        <div className="mh"><span className="mt">Custo Financeiro de Importacao</span><button className="mc" onClick={onClose}>x</button></div>
        <div className="mbody">
          <Box t="blue">{"Formula: FOB x ((1+taxa_mensal)^(dias/30) - 1)\nTaxa em % a.m. (ex: 0,8% a.m.) | Prazo negativo = antecipacao = reducao de custo."}</Box>
          <div className="pbase"><span>FOB de referencia</span><span>{usd(fobUSD)}</span></div>
          <Field label="Transit Time" sfx="dias" value={data.tr} onChange={v=>setData({...data,tr:v})} hint="Dias embarque ate chegada no porto"/>
          <Field label="Prazo de Pagamento ao Fornecedor" sfx="dias" value={data.pp} onChange={v=>setData({...data,pp:v})} hint="Negativo = antecipacao (ex: -30 dias)"/>
          <Field label="Taxa Financeira Mensal" sfx="%" value={data.tx} onChange={v=>setData({...data,tx:v})} hint="Custo do capital mensal (ex: 0,8% a.m.)"/>
          <div className="pdecomp">
            <div><span>Total dias financiados</span><span style={{color:dias<0?"#4ade80":"#94a3b8"}}>{dias} dias {dias<0?"(credito)":""}</span></div>
            <div><span>Fator total ({n3(dias/30)} meses)</span><span>{n3(cfFactor*100)}%</span></div>
            <div><span>CF em USD</span><span style={{color:cfUSD<0?"#4ade80":"#94a3b8"}}>{usd(cfUSD)}</span></div>
            <div><span>PTAX</span><span>R$ {n3(ptax)}</span></div>
          </div>
          <div className="pres" style={{borderColor:cfBRL<0?"#16a34a":"#0047BB"}}>
            <span style={{color:cfBRL<0?"#4ade80":"#93c5fd"}}>Custo Financeiro (BRL)</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:700,color:cfBRL<0?"#4ade80":"#93c5fd"}}>{brl(cfBRL)}</span>
          </div>
          {cfBRL<0&&<Box t="ok">Antecipacao gera reducao de custo. O valor negativo sera subtraido do CMV.</Box>}
          <button className="mapp" onClick={()=>onApply(parseFloat(cfBRL.toFixed(3)))}>Aplicar ao campo CF Importacao</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Frete Ponderado ─────────────────────────────────────────────────────
function ModalFrete({onClose,onApply,data,setData}){
  const tot=data.pS+data.pA+data.pSA;
  const fp=data.sUSD*(data.pS/100)+data.aUSD*(data.pA/100)+data.saUSD*(data.pSA/100);
  const ok=Math.abs(tot-100)<0.001;
  return(
    <div className="ov">
      <div className="mb" onClick={e=>e.stopPropagation()}>
        <div className="mh"><span className="mt">Frete Internacional Ponderado</span><button className="mc" onClick={onClose}>x</button></div>
        <div className="mbody">
          <Box t="blue">{"SEA x %SEA + AIR x %AIR + SEA+AIR x %SEA+AIR\nCusto por modal (USD/un) x percentual de utilizacao."}</Box>
          <div className="ftable">
            <div className="fth"><span>Modal</span><span>USD / un</span><span>% embarques</span></div>
            {[{k:"s",label:"SEA (maritimo)"},{k:"a",label:"AIR (aereo)"},{k:"sa",label:"SEA+AIR (combinado)"}].map(({k,label})=>(
              <div key={k} className="ftr">
                <span style={{fontSize:10,fontWeight:600,color:"#64748b"}}>{label}</span>
                <MI val={data[k+"USD"]} onChange={v=>setData({...data,[k+"USD"]:v})}/>
                <MI val={data["p"+k.toUpperCase()]} onChange={v=>setData({...data,["p"+k.toUpperCase()]:v})} sfx="%"/>
              </div>
            ))}
          </div>
          <div className={`ftot ${ok?"ftok":"ftwarn"}`}>
            <span>Soma: <strong>{n3(tot)}%</strong></span>
            {!ok&&<span style={{fontSize:9,marginLeft:6}}> — deve somar 100%</span>}
          </div>
          <div className="pres"><span>Frete ponderado</span><span>{usd(fp)}</span></div>
          <button className="mapp" disabled={!ok} style={{opacity:ok?1:0.4,cursor:ok?"pointer":"not-allowed"}}
            onClick={()=>onApply(parseFloat(fp.toFixed(3)))}>Aplicar ao campo Frete Internacional</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal PCB ─────────────────────────────────────────────────────────────────
function ModalPCB({onClose,onApply,cfrImp,data,setData}){
  const custo=useMemo(()=>(data.tl/Math.max(1,data.vol))+(data.tempo*1.40)+((data.pctFob/100)*cfrImp*0.01)+1.00,[data,cfrImp]);
  return(
    <div className="ov">
      <div className="mb" onClick={e=>e.stopPropagation()}>
        <div className="mh"><span className="mt">Producao da Placa (PCB)</span><button className="mc" onClick={onClose}>x</button></div>
        <div className="mbody">
          <Box t="blue">{"Formula: (Tooling / Vol.) + (Tempo x R$1,40/min) + (% PCB no FOB x CFR x 1%) + R$1,00"}</Box>
          <Field label="Custo de Tooling" sfx="R$" value={data.tl} onChange={v=>setData({...data,tl:v})}/>
          <Field label="Volume previsto" sfx="un" value={data.vol} onChange={v=>setData({...data,vol:v})}/>
          <Field label="Tempo de fabricacao" sfx="min" value={data.tempo} onChange={v=>setData({...data,tempo:v})} hint="Minutos por unidade — custo: R$1,40/min"/>
          <Field label="% da placa no FOB" sfx="%" value={data.pctFob} onChange={v=>setData({...data,pctFob:v})} hint="% do FOB referente a componentes PCB"/>
          <div className="pbase"><span>CFR importacao (base)</span><span>{brl(cfrImp)}</span></div>
          <div className="pdecomp">
            <div><span>Tooling / vol.</span><span>{brl(data.tl/Math.max(1,data.vol))}</span></div>
            <div><span>Fabricacao ({n3(data.tempo)} min x R$1,40)</span><span>{brl(data.tempo*1.40)}</span></div>
            <div><span>% PCB ({n3(data.pctFob)}%) x CFR x 1%</span><span>{brl((data.pctFob/100)*cfrImp*0.01)}</span></div>
            <div><span>Fixo</span><span>R$ 1,00</span></div>
          </div>
          <div className="pres"><span>Custo unitario da placa</span><span>{brl(custo)}</span></div>
          <button className="mapp" onClick={()=>onApply(parseFloat(custo.toFixed(3)))}>Aplicar ao PPB - Placa</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal CF Venda ────────────────────────────────────────────────────────────
// Formula: (1 + taxa/30)^(prazo + 10) - 1
// taxa em % (ex: 1.14 = 1,14% a.m.)
function ModalCFVenda({onClose,onApply,data,setData}){
  const cfPct=(Math.pow(1+data.taxa/100/30,data.prazo+10)-1)*100;
  return(
    <div className="ov">
      <div className="mb" onClick={e=>e.stopPropagation()}>
        <div className="mh"><span className="mt">Custo Financeiro de Venda</span><button className="mc" onClick={onClose}>x</button></div>
        <div className="mbody">
          <Box t="blue">{"Formula: (1 + taxa/30)^(prazo + 10) - 1\nResultado como % sobre o preco de venda."}</Box>
          <Field label="Prazo de pagamento do cliente" sfx="dias" value={data.prazo} onChange={v=>setData({...data,prazo:v})} hint="Dias de prazo concedidos ao cliente"/>
          <Field label="Taxa financeira (a.m.)" sfx="%" value={data.taxa} onChange={v=>setData({...data,taxa:v})} hint="Padrao: 1,14% a.m."/>
          <div className="pdecomp">
            <div><span>Expoente (prazo + 10)</span><span>{data.prazo+10}</span></div>
            <div><span>Base (1 + taxa/30)</span><span>{n3(1+data.taxa/100/30)}</span></div>
            <div><span>Resultado (decimal)</span><span>{n3(cfPct/100)}</span></div>
          </div>
          <div className="pres"><span>CF Venda (% sobre preco)</span><span>{pct(cfPct)}</span></div>
          <button className="mapp" onClick={()=>onApply(parseFloat(cfPct.toFixed(3)))}>Aplicar ao indice CF Venda</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Registros ───────────────────────────────────────────────────────────
function ModalRegistros({onClose, onLoad, currentD, currentCalcs, prodNome}){
  const [registros, setRegistros] = useState(loadRegistros);
  const [nome, setNome] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const handleSave = () => {
    const label = nome.trim() || prodNome;
    const novo = {
      id: Date.now(),
      nome: label,
      data: new Date().toLocaleString("pt-BR"),
      d: currentD,
      calcs: currentCalcs,
    };
    const updated = [novo, ...registros];
    saveRegistros(updated);
    setRegistros(updated);
    setNome("");
  };

  const handleDelete = (id) => {
    const updated = registros.filter(r => r.id !== id);
    saveRegistros(updated);
    setRegistros(updated);
    setConfirmDel(null);
  };

  return (
    <div className="ov">
      <div className="mb" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
        <div className="mh">
          <span className="mt">Registros Salvos</span>
          <button className="mc" onClick={onClose}>×</button>
        </div>
        <div className="mbody">

          {/* Salvar atual */}
          <div style={{background:"rgba(0,71,187,.08)",border:"1px solid rgba(0,71,187,.25)",padding:"12px 14px",borderRadius:4}}>
            <div style={{fontSize:11,fontWeight:700,color:"#93c5fd",marginBottom:8,letterSpacing:.5,textTransform:"uppercase"}}>Salvar precificação atual</div>
            <div style={{display:"flex",gap:8}}>
              <div className="fw" style={{flex:1,minWidth:0}}>
                <input
                  type="text"
                  placeholder={prodNome}
                  value={nome}
                  onChange={e=>setNome(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&handleSave()}
                  style={{background:"none",border:"none",outline:"none",fontFamily:"'IBM Plex Sans',sans-serif",fontSize:12,color:"#dce7f7",padding:"7px 10px",width:"100%"}}
                />
              </div>
              <button className="mapp" style={{padding:"7px 18px",borderRadius:4,fontSize:12}} onClick={handleSave}>
                💾 Salvar
              </button>
            </div>
          </div>

          {/* Lista */}
          {registros.length === 0
            ? <div style={{textAlign:"center",padding:"24px 0",fontFamily:"'DM Mono',monospace",fontSize:11,color:"#5a6a84"}}>Nenhum registro salvo ainda.</div>
            : <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:380,overflowY:"auto"}}>
                {registros.map(r=>(
                  <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"#2a3550",border:"1px solid rgba(255,255,255,.08)",borderRadius:4}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#dce7f7",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.nome}</div>
                      <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"#5a6a84",marginTop:2}}>
                        {r.data} · {PRODUTOS.find(p=>p.id===r.d.prodId)?.uf||""} → {r.d.ufDestino} · M {r.d.margem}%
                      </div>
                    </div>
                    {confirmDel===r.id
                      ? <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:11,color:"#f87171"}}>Excluir?</span>
                          <button onClick={()=>handleDelete(r.id)} style={{padding:"4px 10px",background:"#dc2626",border:"none",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",borderRadius:3}}>Sim</button>
                          <button onClick={()=>setConfirmDel(null)} style={{padding:"4px 10px",background:"#2a3550",border:"1px solid rgba(255,255,255,.15)",color:"#94a3b8",fontSize:11,cursor:"pointer",borderRadius:3}}>Não</button>
                        </div>
                      : <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>{onLoad(r.d, r.calcs);onClose();}}
                            style={{padding:"6px 14px",background:"#0047BB",border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",borderRadius:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:.5}}>
                            ↩ Carregar
                          </button>
                          <button onClick={()=>setConfirmDel(r.id)}
                            style={{padding:"6px 10px",background:"rgba(220,38,38,.1)",border:"1px solid rgba(220,38,38,.25)",color:"#f87171",fontSize:12,cursor:"pointer",borderRadius:3}}>
                            ✕
                          </button>
                        </div>
                    }
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

// ── Breakdown Panel ───────────────────────────────────────────────────────────
function BreakdownPanel({c,d,prod,ppbTot,calcs}){
  const fobBRL=d.fobUSD*d.ptax;
  const freteBRL=d.freteUSD*d.ptax;
  const cmvImpTotal=c.cmvImp+d.cfImp; // CMV Imp inclui CF
  const vplDisp=cmvImpTotal+ppbTot+(d.cra||0);
  const garantiaBkp=d.garantia+c.bkpV;
  const custosLocais=d.producao+d.outrosBRL;
  const pcVNominal=c.pSI*(c.pcPct/100);
  const pcSubvSaving=pcVNominal-c.pcV;
  const totalImp=c.cargaTot+(c.ftiPct>0?c.ftiV:0);
  const totalIndGerPct=d.pd+d.scrap+d.royal+d.frete;
  const totalIndGerV=c.pdV+c.scV+c.ryV+c.frV;
  const totalIndComPct=d.comis+(d.comis*2/3)+d.mkt+d.rebate+d.cfVenda;
  const totalIndComV=c.cmV+c.mktV+c.rebateV+c.cfnV;
  const mcV=c.margV+c.cfxV;

  // row helpers
  const R=({l,v,p,acc,bold,sep,sub,indent,dual})=>(
    <div className={`bdr ${bold?"bdb":""} ${sep?"bds":""} ${acc||""} ${sub?"bdsub":""}`}>
      <span className="bdl" style={indent?{paddingLeft:14}:undefined}>{l}</span>
      {p!=null&&<span className="bdp">{pct(p)}</span>}
      <span className="bdv">
        {dual&&<span className="bdv2">{dual}</span>}
        {brl(v)}
      </span>
    </div>
  );
  const Sep=({label,v,p,color})=>(
    <div className="bdtot" style={color?{borderColor:color}:undefined}>
      <span>{label}</span>
      {p!=null&&<span className="bdtotp">{pct(p)}</span>}
      <span className="bdtotv" style={color?{color}:undefined}>{brl(v)}</span>
    </div>
  );
  const GH=({t})=><div className="bdgh">{t}</div>;

  return(
    <div className="bdc">
      {/* ── CUSTO DE IMPORTAÇÃO ── */}
      <GH t="CUSTO DE IMPORTAÇÃO"/>
      <R l="FOB" v={fobBRL} dual={usd(d.fobUSD)}/>
      <R l="(+) Frete Internacional" v={freteBRL} dual={usd(d.freteUSD)} indent/>
      <R l={`(+) II (${pct(d.aliqII)})`} v={c.iiV} indent acc="red"/>
      <R l={`(+) Despesas (${d.despesasModo==="pct"?pct(d.despesasPct)+" CFR":"manual"})`} v={c.despesas} indent acc="red"/>
      <R l="(+) Seguro" v={d.seguroBRL} indent/>
      {d.cfImp!==0&&<R l="(+) CF Importação" v={d.cfImp} indent acc={d.cfImp<0?"green":""}/>}
      <Sep label="CMV IMPORTAÇÃO" v={cmvImpTotal}/>

      {/* ── PPB + VPL ── */}
      {ppbTot>0&&<R l="(+) PPB Total" v={ppbTot}/>}
      {(d.cra||0)>0&&<R l="(+) CRA / Créditos" v={d.cra}/>}
      <Sep label="VPL" v={vplDisp} color="#2563eb"/>

      {/* ── CUSTOS LOCAIS ── */}
      <GH t="CUSTOS LOCAIS"/>
      <R l="Garantia" v={d.garantia}/>
      <R l={`BKP (${pct(d.bkpPct)} × VPL)`} v={c.bkpV} indent sub/>
      <R l="Garantia + BKP" v={garantiaBkp} bold sep/>
      <R l="Produção / Montagem" v={d.producao}/>
      <R l="Outros custos BRL" v={d.outrosBRL} indent sub/>
      <R l="Custos Locais" v={custosLocais} bold sep/>
      <Sep label="CUSTO TOTAL" v={c.cmvTotal} color="#0047BB"/>

      {/* ── IMPOSTOS DE VENDA ── */}
      <GH t="IMPOSTOS DE VENDA"/>
      <R l={`P/C nominal (${pct(c.pcPct)})`} v={pcVNominal} p={c.pcPct} acc="red"/>
      {pcSubvSaving>0.001&&<R l={`(-) Subvenção ICMS destacado (${pct(c.aliqInter)})`} v={-pcSubvSaving} p={-(c.pcPct-c.pcEf)} indent acc="green"/>}
      <R l={`P/C efetivo (${pct(c.pcEf)})`} v={c.pcV} p={c.pcEf} indent bold/>
      {c.icmsEfPct>0&&<R l={`ICMS efetivo (${pct(c.icmsEfPct)})`} v={c.icmsEfV} p={c.icmsEfPct} acc="red"/>}
      {c.difal>0&&<R l={`DIFAL (${pct(c.difal)})`} v={c.difalV} p={c.difal} acc="red"/>}
      {c.ipi>0&&<R l={`IPI (${pct(c.ipi)})`} v={c.ipiV} p={c.ipi} acc="red"/>}
      {c.stV>0&&<R l="ICMS-ST" v={c.stV} acc="warn"/>}
      {c.ftiPct>0&&<R l={`FTI/UEA-AM (${pct(c.ftiPct)})`} v={c.ftiV} acc="red"/>}
      {c.fcpPct>0&&<R l={`Fundo Pobreza ${d.ufDestino}`} v={c.fcpV} acc="warn"/>}
      <R l="Total Impostos" v={totalImp} p={c.cargaPct} bold sep/>

      {/* ── ÍNDICES GERAIS ── */}
      <GH t="ÍNDICES GERAIS"/>
      <R l={`P&D (${pct(d.pd)})`} v={c.pdV} p={d.pd}/>
      <R l={`Scrap (${pct(d.scrap)})`} v={c.scV} p={d.scrap}/>
      <R l={`Royalties (${pct(d.royal)})`} v={c.ryV} p={d.royal}/>
      <R l={`Frete venda (${pct(d.frete)})`} v={c.frV} p={d.frete}/>
      <R l="Subtotal Índices Gerais" v={totalIndGerV} p={totalIndGerPct} bold sep/>

      {/* ── ÍNDICES COMERCIAIS ── */}
      <GH t="ÍNDICES COMERCIAIS"/>
      <R l={`Comissão + Encargos (${pct(d.comis+c.comisXPct)})`} v={c.cmV} p={d.comis+c.comisXPct}/>
      {d.mkt>0&&<R l={`Marketing (${pct(d.mkt)})`} v={c.mktV} p={d.mkt}/>}
      {d.rebate>0&&<R l={`Rebate (${pct(d.rebate)})`} v={c.rebateV} p={d.rebate}/>}
      <R l={`CF Venda (${pct(d.cfVenda)})`} v={c.cfnV} p={d.cfVenda}/>
      <R l="Subtotal Índices Comerciais" v={totalIndComV} p={totalIndComPct} bold sep/>

      {/* ── RESULTADO ── */}
      <div style={{height:4}}/>
      <R l={`MC — Margem de Contribuição`} v={mcV} p={c.mc} bold acc="blue" sep/>
      <R l={`Custo Fixo (${pct(d.cfixo)})`} v={c.cfxV} p={d.cfixo} indent/>
      <Sep label="ML — MARGEM LÍQUIDA" v={c.margV} p={c.margPct} color="#059669"/>
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#1c2333;color:#dce7f7;font-family:'IBM Plex Sans',sans-serif;min-height:100vh}
input::-webkit-inner-spin-button,input::-webkit-outer-spin-button{-webkit-appearance:none}
.app{min-height:100vh;display:flex;flex-direction:column}
.hdr{background:#232c3d;color:#fff;padding:0 20px;display:flex;align-items:center;gap:16px;min-height:58px;border-bottom:3px solid #0047BB;flex-wrap:wrap}
.buf{padding:4px 10px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;border-radius:20px}
.buf.zmf{background:rgba(0,71,187,.35);color:#93c5fd;border:1px solid rgba(0,71,187,.5)}.buf.ios{background:rgba(26,101,212,.35);color:#93c5fd;border:1px solid rgba(26,101,212,.5)}.buf.cwb{background:rgba(100,116,139,.2);color:#94a3b8;border:1px solid rgba(100,116,139,.3)}
.brt{padding:3px 9px;font-family:'DM Mono',monospace;font-size:9px;border:1px solid rgba(255,255,255,.12);color:#7a90b0;border-radius:20px}
.bdf{padding:3px 9px;font-family:'DM Mono',monospace;font-size:9px;border-radius:20px;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.25);color:#f87171}
.layout{display:grid;grid-template-columns:385px 1fr;flex:1;min-height:calc(100vh - 61px)}
.pleft{background:#1e2a3d;border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column}
.tnav{display:flex;border-bottom:1px solid rgba(255,255,255,.08);background:#1c2333}
.tbtn{flex:1;padding:11px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#7a90b0;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;transition:.15s}
.tbtn.on{color:#f0f4ff;border-bottom-color:#0047BB;background:rgba(0,71,187,.15)}
.tbtn:hover:not(.on){color:#c4d4e8;background:rgba(255,255,255,.04)}
.pscroll{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.sec{border:1px solid rgba(255,255,255,.08);overflow:hidden;background:#232c3d;border-radius:6px}
.sec.hl{border-color:rgba(0,71,187,.6)}
.sech{padding:9px 13px;background:#2a3550;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;min-height:34px}
.sec.hl .sech{background:#0047BB}
.sect{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f0f4ff}
.sec.hl .sect{color:#fff}
.sectag{font-family:'DM Mono',monospace;font-size:9px;color:#7a90b0;padding:2px 7px;border:1px solid rgba(255,255,255,.1);border-radius:20px}
.sec.hl .sectag{color:rgba(255,255,255,.65);border-color:rgba(255,255,255,.25)}
.secb{padding:12px 13px;display:flex;flex-direction:column;gap:9px}
.fw{display:flex;align-items:center;border:1px solid rgba(255,255,255,.1);background:#1a2030;overflow:hidden;min-width:115px;flex-shrink:0;transition:.15s;border-radius:4px}
.fw:focus-within{border-color:#0047BB;box-shadow:0 0 0 2px rgba(0,71,187,.2)}
.fro{opacity:.45;pointer-events:none}
.flocked{border-color:rgba(0,71,187,.5)!important;background:rgba(0,71,187,.07)!important}
.fpre{padding:0 8px;font-family:'DM Mono',monospace;font-size:10px;color:#7a90b0;background:#161e2c;border-right:1px solid rgba(255,255,255,.08);white-space:nowrap;align-self:stretch;display:flex;align-items:center}
.fsel{border:1px solid rgba(255,255,255,.1);background:#1a2030;padding:7px 8px;font-family:'DM Mono',monospace;font-size:11px;color:#dce7f7;outline:none;min-width:115px;flex-shrink:0;cursor:pointer;border-radius:4px}
.fsel:focus{border-color:#0047BB}
.cbtn{width:28px;height:28px;background:#2a3550;border:1px solid rgba(255,255,255,.1);cursor:pointer;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.15s;border-radius:4px;color:#7a90b0;font-family:'DM Mono',monospace}
.cbtn:hover{border-color:#0047BB;background:rgba(0,71,187,.2);color:#93c5fd}
.cbtn.cactive{border-color:#0047BB!important;color:#93c5fd!important;background:rgba(0,71,187,.25)!important}
.cunlock{font-size:13px;color:#7a90b0!important}
.cunlock:hover{color:#fbbf24!important;border-color:rgba(251,191,36,.4)!important;background:rgba(251,191,36,.08)!important}
.rgb{flex:1;padding:7px 8px;background:#1a2030;border:1px solid rgba(255,255,255,.1);color:#7a90b0;font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:.15s;min-width:60px;border-radius:3px}
.rgb.on{background:rgba(0,71,187,.2);border-color:rgba(0,71,187,.5);color:#93c5fd;font-weight:600}
.rgb:hover:not(.on){border-color:rgba(255,255,255,.2);color:#c4d4e8}
.tog{width:40px;height:22px;background:#2a3550;border:1px solid rgba(255,255,255,.12);border-radius:11px;cursor:pointer;position:relative;transition:.2s;flex-shrink:0}
.tog.on{background:#0047BB;border-color:#0047BB}
.tknob{position:absolute;top:3px;left:3px;width:14px;height:14px;background:#7a90b0;border-radius:50%;transition:.2s}
.tog.on .tknob{transform:translateX(18px);background:#fff}
.ib{padding:8px 11px;font-size:11px;line-height:1.65;border-left:3px solid;white-space:pre-wrap;border-radius:0 4px 4px 0}
.ib.blue{background:rgba(0,71,187,.1);border-color:#0047BB;color:#93c5fd}
.ib.gray{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.1);color:#7a90b0;font-family:'DM Mono',monospace;font-size:10px}
.ib.ok{background:rgba(22,163,74,.08);border-color:#16a34a;color:#4ade80}
.ib.warn{background:rgba(217,119,6,.08);border-color:#d97706;color:#fbbf24}
.dr{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;color:#7a90b0}
.dr:last-child{border-bottom:none}.drb{font-weight:700;color:#dce7f7}.drs{border-top:1px solid rgba(255,255,255,.08);margin-top:4px;padding-top:7px}
.dr.red .dv{color:#f87171;font-weight:600}.dr.green .dv{color:#4ade80;font-weight:600}.dr.blue .dv{color:#60a5fa;font-weight:600}.dr.warn .dv{color:#fbbf24;font-weight:600}
.dv{font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:#a8b5cc}
.drb .dv{color:#dce7f7}
.psel{width:100%;padding:8px 10px;border:1px solid rgba(255,255,255,.1);background:#1a2030;font-family:'DM Mono',monospace;font-size:11px;color:#dce7f7;outline:none;border-radius:4px}
.psel:focus{border-color:#0047BB}
.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:5px}
.pchip{background:#1a2030;border:1px solid rgba(255,255,255,.08);padding:6px 10px;border-radius:4px}
.pcl{display:block;font-size:9px;color:#3d5070;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;font-family:'DM Mono',monospace}
.pcv{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:#dce7f7}
.zmfi{display:flex;gap:8px;padding:9px 11px;border:1px solid rgba(255,255,255,.08);cursor:pointer;background:#1a2030;transition:.15s;border-radius:4px}
.zmfi.sel{border-color:rgba(0,71,187,.6);background:rgba(0,71,187,.1)}.zmfi:hover:not(.sel){border-color:rgba(255,255,255,.18)}
.rdot{width:13px;height:13px;border-radius:50%;border:2px solid rgba(255,255,255,.15);transition:.15s;margin-top:2px;flex-shrink:0}
.rdot.on{border-color:#0047BB;background:#0047BB;box-shadow:0 0 0 3px rgba(0,71,187,.2)}
.ppbi{border:1px solid rgba(255,255,255,.08);overflow:hidden;border-radius:5px}.ppbc{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;background:#2a3550;width:100%}
.ppbc input[type=checkbox]{display:none}
.ppbcb{width:16px;height:16px;border:2px solid rgba(255,255,255,.15);flex-shrink:0;background:#1a2030;transition:.15s;position:relative;border-radius:3px}
.ppbc input:checked+.ppbcb{background:#0047BB;border-color:#0047BB}
.ppbc input:checked+.ppbcb::after{content:"v";position:absolute;top:-1px;left:2px;color:#fff;font-size:10px;font-weight:700}
.ppbtot{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#0047BB;color:#fff;font-family:'DM Mono',monospace;font-size:13px;font-weight:700;margin-top:4px}
.cvres{display:flex;justify-content:space-between;align-items:center;padding:11px 13px;background:rgba(0,71,187,.12);border:1px solid rgba(0,71,187,.35);border-radius:4px}
.cvres span:first-child{font-size:12px;font-weight:600;color:#93c5fd}
.txgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.txc{padding:9px 11px;border:1px solid rgba(255,255,255,.08);background:#1a2030;border-radius:4px}
.txon{border-color:rgba(248,113,113,.25);background:rgba(220,38,38,.06)}.txok{border-color:rgba(74,222,128,.2);background:rgba(22,163,74,.06)}.txwn{border-color:rgba(251,191,36,.2);background:rgba(217,119,6,.06)}
.txl{font-size:9px;color:#5a6a84;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;font-family:'DM Mono',monospace;line-height:1.3}
.txv{font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:#dce7f7}
.txon .txv{color:#f87171}.txok .txv{color:#4ade80}
.pright{padding:18px 22px;overflow-y:auto;display:flex;flex-direction:column;gap:13px;background:#1c2333}
.hero{background:linear-gradient(135deg,#0f2a6e,#0a1a45);padding:18px 22px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;border:1px solid rgba(0,71,187,.2);border-bottom:3px solid #0047BB;border-radius:6px}
.kpi{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);padding:9px 14px;text-align:center;min-width:80px;border-radius:5px}
.kpi-red{border-color:rgba(248,113,113,.2);background:rgba(220,38,38,.06)}.kpi-green{border-color:rgba(74,222,128,.2);background:rgba(22,163,74,.06)}.kpi-blue{border-color:rgba(96,165,250,.2);background:rgba(0,71,187,.07)}
.kpi-red span:last-child{color:#f87171!important}.kpi-green span:last-child{color:#4ade80!important}.kpi-blue span:last-child{color:#93c5fd!important}
.rcard{background:#232c3d;border:1px solid rgba(255,255,255,.08);padding:12px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-radius:6px}
.rlbl{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#5a6a84;white-space:nowrap;flex-shrink:0}
.rbody{display:flex;align-items:center;gap:12px;flex:1;flex-wrap:wrap}
.riw{display:flex;align-items:center;border:1px solid rgba(255,255,255,.12);background:#1a2030;overflow:hidden;border-radius:4px}
.riw:focus-within{border-color:#0047BB}
.rpfx{padding:0 10px;font-family:'DM Mono',monospace;font-size:12px;color:#7a90b0;background:#161e2c;border-right:1px solid rgba(255,255,255,.08);align-self:stretch;display:flex;align-items:center}
.ri{background:none;border:none;outline:none;font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:#dce7f7;padding:8px 10px;width:160px;text-align:right}
.rcl{padding:0 9px;background:none;border:none;border-left:1px solid rgba(255,255,255,.08);color:#7a90b0;font-size:12px;cursor:pointer;align-self:stretch;display:flex;align-items:center}
.rcl:hover{color:#f87171}
.rres{display:flex;flex-direction:column;gap:4px;flex:1}
.rrmain{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;color:#a8b5cc}
.rrv{font-family:'DM Mono',monospace;font-size:20px;font-weight:800}
.rpos .rrv{color:#4ade80}.rneg .rrv{color:#f87171}
.rrsub{display:flex;flex-direction:column;gap:2px}
.rrsub span{font-family:'DM Mono',monospace;font-size:10px;color:#5a6a84}
.strip{display:flex;align-items:center;gap:3px;flex-wrap:wrap;background:#232c3d;border:1px solid rgba(255,255,255,.08);padding:10px 14px;border-radius:6px}
.sb{border:1px solid rgba(255,255,255,.08);padding:6px 10px;min-width:68px;text-align:center;background:#1a2030;border-radius:4px}
.sb.hl{border-color:rgba(255,255,255,.15);background:#2a3550}.sb.blue{border-color:rgba(0,71,187,.4);background:rgba(0,71,187,.12)}.sb.dk{border-color:rgba(255,255,255,.1);background:#1a2030}
.sbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#5a6a84;margin-bottom:2px;font-family:'Barlow Condensed',sans-serif}
.sbv{font-family:'DM Mono',monospace;font-size:10px;font-weight:700;color:#a8b5cc}
.sb.hl .sbv,.sb.dk .sbv{color:#dce7f7}.sb.blue .sbv{color:#93c5fd}
.wfc{background:#232c3d;border:1px solid rgba(255,255,255,.08);padding:14px;border-radius:6px}
.ctit{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#dce7f7;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #0047BB;display:inline-block}
.wfr{display:flex;align-items:center;gap:6px;padding:3px 0}
.wft .wfl{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;color:#dce7f7;text-transform:uppercase}
.wfs .wfl{color:#5a6a84;font-size:10px;padding-left:10px}
.wfl{width:195px;font-size:11px;font-weight:600;color:#7a90b0;flex-shrink:0;line-height:1.3}
.wftr{flex:1;height:12px;background:#1a2030;overflow:hidden;border-radius:3px}
.wff{height:100%;transition:width .3s;opacity:.9}
.wfp{width:42px;text-align:right;font-family:'DM Mono',monospace;font-size:9px;color:#3d5070;flex-shrink:0}
.wfv{width:80px;text-align:right;font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#7a90b0;flex-shrink:0}
.wft .wfv{font-size:13px;font-weight:700;color:#93c5fd}
.dc{background:#232c3d;border:1px solid rgba(255,255,255,.08);padding:14px;border-radius:6px}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
.mb{background:#232c3d;border:1.5px solid rgba(0,71,187,.6);width:100%;max-width:460px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;border-radius:8px}
.mh{padding:13px 17px;background:#2a3550;border-bottom:1px solid rgba(0,71,187,.3);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:1;border-radius:8px 8px 0 0}
.mt{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#f0f4ff}
.mc{background:none;border:none;color:#7a90b0;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.mc:hover{color:#dce7f7}
.mbody{padding:15px;display:flex;flex-direction:column;gap:10px}
.pbase{display:flex;justify-content:space-between;align-items:center;padding:7px 11px;background:#1a2030;border:1px solid rgba(255,255,255,.08);font-family:'DM Mono',monospace;font-size:11px;color:#7a90b0;border-radius:4px}
.pbase span:last-child{color:#93c5fd;font-weight:700}
.pdecomp{background:#1a2030;border:1px solid rgba(255,255,255,.08);padding:9px 11px;display:flex;flex-direction:column;gap:5px;border-radius:4px}
.pdecomp div{display:flex;justify-content:space-between;font-size:11px;font-family:'DM Mono',monospace;color:#7a90b0;border-bottom:1px solid rgba(255,255,255,.04);padding-bottom:4px}
.pdecomp div:last-child{border-bottom:none;padding-bottom:0}
.pdecomp div span:last-child{color:#a8b5cc}
.pres{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:rgba(0,71,187,.14);border:1.5px solid rgba(0,71,187,.5);border-radius:4px}
.pres span:first-child{font-size:12px;font-weight:600;color:#93c5fd}.pres span:last-child{font-family:'DM Mono',monospace;font-size:17px;font-weight:700;color:#93c5fd}
.mapp{padding:11px;background:#0047BB;border:none;color:#fff;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;transition:.15s}
.mapp:hover{background:#1a65d4}
.ftable{display:flex;flex-direction:column;gap:3px}
.fth{display:grid;grid-template-columns:1fr 100px 100px;gap:6px;padding:4px 9px;font-family:'DM Mono',monospace;font-size:9px;color:#3d5070;text-transform:uppercase;letter-spacing:.5px}
.ftr{display:grid;grid-template-columns:1fr 100px 100px;gap:6px;align-items:center;padding:5px 9px;background:#1a2030;border:1px solid rgba(255,255,255,.05);border-radius:3px}
.ftot{display:flex;align-items:center;padding:7px 11px;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;border-radius:4px}
.ftok{background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);color:#4ade80}
.ftwarn{background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.2);color:#fbbf24}
.desp-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.desp-modes{display:flex;gap:3px}
.moeda-toggle{display:flex;align-items:center;gap:7px;padding:7px 14px;border-bottom:1px solid rgba(255,255,255,.07);background:#1c2333;flex-shrink:0}
.moeda-toggle span{font-size:10px;font-weight:700;color:#5a6a84;letter-spacing:.4px;text-transform:uppercase}
.moeda-toggle .rgb{flex:none;padding:4px 12px;font-size:11px}
.bdc{background:#232c3d;border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden}
.bdgh{padding:9px 14px;background:#2a3550;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#f0f4ff;border-bottom:1px solid rgba(255,255,255,.07);margin-top:0}
.bdgh:not(:first-child){border-top:2px solid rgba(255,255,255,.06);margin-top:4px}
.bdr{display:flex;align-items:center;padding:5px 14px;gap:6px;border-bottom:1px solid rgba(255,255,255,.03)}
.bdr:last-child{border-bottom:none}
.bdr.bdb{font-weight:700}
.bdr.bds{border-top:1px solid rgba(255,255,255,.08);margin-top:2px;padding-top:7px}
.bdr.bdsub .bdl{color:#5a6a84}
.bdr.red .bdv{color:#f87171}.bdr.green .bdv{color:#4ade80!important}.bdr.blue .bdv{color:#93c5fd}.bdr.warn .bdv{color:#fbbf24}
.bdr.red .bdp{color:#f87171}.bdr.green .bdp{color:#4ade80}.bdr.blue .bdp{color:#93c5fd}
.bdl{flex:1;font-size:11px;color:#a8b5cc;line-height:1.3}
.bdb .bdl{color:#dce7f7;font-weight:700}
.bdp{width:52px;text-align:right;font-family:'DM Mono',monospace;font-size:10px;color:#5a6a84;flex-shrink:0}
.bdv{width:100px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#a8b5cc;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:1px}
.bdb .bdv{font-size:12px;font-weight:700;color:#dce7f7}
.bdv2{font-size:9px;color:#5a6a84;font-weight:400}
.bdtot{display:flex;align-items:center;padding:9px 14px;gap:6px;border-top:2px solid rgba(255,255,255,.1);background:#1a2030;margin:2px 0 0}
.bdtot span:first-child{flex:1;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#dce7f7}
.bdtotp{width:52px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:#7a90b0;flex-shrink:0}
.bdtotv{width:100px;text-align:right;font-family:'DM Mono',monospace;font-size:14px;font-weight:800;color:#93c5fd;flex-shrink:0}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#1c2333}::-webkit-scrollbar-thumb{background:#2a3550;border-radius:3px}::-webkit-scrollbar-thumb:hover{background:#0047BB}
`;

// ── APP ────────────────────────────────────────────────────────────────────────
export default function App(){
  const [d,setD]=useState(DEF);
  const [calcs,setCalcs]=useState(CALC_DEF);
  const [tab,setTab]=useState("perfil");
  const [modal,setModal]=useState(null);

  const S=k=>v=>setD(p=>({...p,[k]:v}));
  const SC=k=>v=>setCalcs(p=>({...p,[k]:{...p[k],...v}}));
  // ── Helpers de moeda (campos BRL que podem ser editados em USD) ──
  const isBRL=d.moedaCusto!=="USD";
  const toDisp=v=>isBRL?v:+(v/d.ptax).toFixed(4);
  const toStore=v=>isBRL?v:+(v*d.ptax).toFixed(4);
  const sfxM=isBRL?"R$":"USD";

  const prod=useMemo(()=>PRODUTOS.find(p=>p.id===d.prodId)||PRODUTOS[0],[d.prodId]);
  const isZFM=prod.uf==="AM";
  const pcEntry=PC_ZFM.find(e=>e.k===d.pcZfmKey)||PC_ZFM[1];
  const setProd=id=>{const p=PRODUTOS.find(x=>x.id===id)||PRODUTOS[0];setD(pv=>({...pv,prodId:id,stAtivo:p.mva>0,mva:p.mva,icmsDestST:p.aliqST}));};
  const ppbTot=useMemo(()=>PPB_ITEMS.reduce((s,i)=>s+(d.ppbAtivos[i.id]?+d.ppbVals[i.id]||0:0),0),[d.ppbAtivos,d.ppbVals]);

  const c=useMemo(()=>{
    const cfrUSD=d.fobUSD+d.freteUSD;
    const cfrBRL=cfrUSD*d.ptax;
    const iiV=cfrBRL*(d.aliqII/100);
    const despesas=d.despesasModo==="pct"?cfrBRL*d.despesasPct/100:d.despesas;
    const cfrImp=cfrBRL+iiV+despesas;
    const cmvImp=cfrBRL+iiV+despesas+d.seguroBRL;
    const vpl=cmvImp+d.cfImp+ppbTot+d.cra;
    const bkpV=vpl*(d.bkpPct/100);
    const cmvTotal=cmvImp+d.producao+d.garantia+bkpV+d.outrosBRL+ppbTot;

    let pcPct,pcLabel;
    if(isZFM&&prod.pcBase==="zmf"){pcPct=pcEntry.pct;pcLabel=`ZFM ${pct(pcPct)}`;}
    else if(typeof prod.pcBase==="number"){pcPct=prod.pcBase;pcLabel=pct(pcPct);}
    else{pcPct=d.regimeVendedor==="presumido"?3.65:9.25;pcLabel=pct(pcPct);}

    const ufO=prod.uf,ufD=d.ufDestino,intra=ufO===ufD;
    const aliqInter=getICMS(ufO,ufD);
    const aliqDest=ALIQ_INT[ufD]||18;
    const icmsEfPct=Math.max(0,aliqInter-prod.cred);
    let difal=0;
    const deveDifal=d.tipoComprador==="naocontrib"||(d.tipoComprador==="contrib"&&d.destinacaoCliente==="imobilizado");
    if(!intra&&deveDifal){const delta=aliqDest-aliqInter;if(delta>0)difal=(prod.aliqST>0&&delta<prod.aliqST)?0:delta;}

    const pcEf=pcPct*(1-(aliqInter+difal)/100);
    const ftiPct=(isZFM&&d.ftiAtivo)?prod.fti:0;
    const fcpPct=FCP[ufD]||0;
    const ipi=prod.ipi;
    const comisXPct=d.comis*(2/3);
    const indPct=d.pd+d.cfixo+d.scrap+d.royal+d.cfVenda+d.frete+d.comis+comisXPct+d.mkt+d.rebate;
    const soma=(pcEf+icmsEfPct+difal+ftiPct+fcpPct+indPct+d.margem)/100;
    const pSI=soma<1?cmvTotal/(1-soma):cmvTotal*99;
    const ipiV=pSI*(ipi/100),pCI=pSI+ipiV;
    const pcV=pSI*(pcEf/100),icmsV=pSI*(aliqInter/100);
    const icmsEfV=pSI*(icmsEfPct/100),difalV=pSI*(difal/100);
    const ftiV=pSI*(ftiPct/100),fcpV=pSI*(fcpPct/100);
    const margV=pSI*(d.margem/100);
    const pdV=pSI*(d.pd/100),cfxV=pSI*(d.cfixo/100);
    const scV=pSI*(d.scrap/100),ryV=pSI*(d.royal/100);
    const cfnV=pSI*(d.cfVenda/100),frV=pSI*(d.frete/100),cmV=pSI*((d.comis+comisXPct)/100);
    const mktV=pSI*(d.mkt/100),rebateV=pSI*(d.rebate/100);
    let stV=0,stBase=0;
    if(d.stAtivo&&d.mva>0){stBase=pCI*(1+d.mva/100);stV=Math.max(0,stBase*(d.icmsDestST/100)-icmsV);}
    const pF=pCI+stV;
    const pUSD=d.ptax>0?pF/d.ptax:0;
    const cargaTot=pcV+ipiV+icmsEfV+difalV+stV+fcpV;
    const cargaPct=pF>0?(cargaTot/pF)*100:0;
    const margPct=pF>0?(margV/pF)*100:0;
    // MC = Margem de Contribuicao = ML + Custo Fixo (ambos sobre o preco)
    const mc=pF>0?((margV+cfxV)/pF)*100:0;
    const mkp=cmvTotal>0?pF/cmvTotal:0;
    let margemAlvo=null;
    if(d.precoAlvo>0){
      const pSIa=d.precoAlvo/(1+ipi/100);
      const sf=(pcEf+icmsEfPct+difal+ftiPct+fcpPct+indPct)/100;
      margemAlvo=pSIa>0?(1-cmvTotal/pSIa)*100-sf*100:null;
    }
    return{cfrUSD,cfrBRL,iiV,vpl,bkpV,cfrImp,cmvImp,cmvTotal,ppbTot,despesas,
      pcPct,pcEf,pcLabel,pcV,aliqInter,aliqDest,icmsEfPct,icmsV,icmsEfV,
      difal,difalV,ftiPct,ftiV,fcpPct,fcpV,ipi,ipiV,pSI,pCI,
      margV,indPct,pdV,cfxV,scV,ryV,cfnV,frV,cmV,mktV,rebateV,stV,stBase,pF,pUSD,
      cargaTot,cargaPct,margPct,mc,mkp,ufO,intra,deveDifal,margemAlvo,comisXPct};
  },[d,prod,isZFM,pcEntry,ppbTot]);

  const TABS=["perfil","importacao","ppb","producao","indices","venda","st"];
  const TLBL=["Perfil","Importacao","PPB","Producao","Indices","Venda","ST"];

  return(
    <>
    <style>{CSS}</style>
    {modal==="cfImp"&&<ModalCF onClose={()=>setModal(null)} fobUSD={d.fobUSD} ptax={d.ptax}
      data={calcs.cfImp} setData={v=>SC("cfImp")(v)}
      onApply={v=>{setD(p=>({...p,cfImp:v}));SC("cfImp")({applied:true});setModal(null);}}/>}
    {modal==="frete"&&<ModalFrete onClose={()=>setModal(null)}
      data={calcs.frete} setData={v=>SC("frete")(v)}
      onApply={v=>{setD(p=>({...p,freteUSD:v}));SC("frete")({applied:true});setModal(null);}}/>}
    {modal==="pcb"&&<ModalPCB onClose={()=>setModal(null)} cfrImp={c.cfrImp}
      data={calcs.pcb} setData={v=>SC("pcb")(v)}
      onApply={v=>{setD(p=>({...p,ppbAtivos:{...p.ppbAtivos,placa:true},ppbVals:{...p.ppbVals,placa:v}}));setModal(null);}}/>}
    {modal==="cfVenda"&&<ModalCFVenda onClose={()=>setModal(null)}
      data={calcs.cfVenda} setData={v=>SC("cfVenda")(v)}
      onApply={v=>{setD(p=>({...p,cfVenda:v}));SC("cfVenda")({applied:true});setModal(null);}}/>}
    {modal==="registros"&&<ModalRegistros
      onClose={()=>setModal(null)}
      currentD={d} currentCalcs={calcs}
      prodNome={prod.nome}
      onLoad={(savedD, savedCalcs)=>{setD(savedD);setCalcs(savedCalcs);}}/>}

    <div className="app">
      <header className="hdr">
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:800,color:"#0047BB",lineHeight:1}}>+</span>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,letterSpacing:1,color:"#fff"}}>POSITIVO</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:600,letterSpacing:2,color:"#555"}}>TECNOLOG<span style={{color:"#0047BB"}}>IA</span></div>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:1}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,color:"#e2e8f0"}}>CALCULADORA TRIBUTARIA</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444"}}>PLAN_TRIB · 09/02/2026 · v8</span>
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          {isZFM&&<span className="buf zmf">ZFM / MAO</span>}
          {prod.uf==="BA"&&<span className="buf ios">IOS / BA</span>}
          {prod.uf==="PR"&&<span className="buf cwb">CWB / PR</span>}
          <span className="brt">{c.ufO} -> {d.ufDestino}</span>
          <span className="bdf">{c.difal>0?`DIFAL ${pct(c.difal)}`:"DIFAL 0%"}</span>
          <button onClick={()=>setModal("registros")}
            style={{padding:"5px 13px",background:"rgba(0,71,187,.2)",border:"1px solid rgba(0,71,187,.45)",color:"#93c5fd",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:.5,cursor:"pointer",borderRadius:20,display:"flex",alignItems:"center",gap:5}}>
            💾 <span>Registros</span>
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="pleft">
          <nav className="tnav">
            {TABS.map((t,i)=><button key={t} className={`tbtn ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{TLBL[i]}</button>)}
          </nav>
          <div className="moeda-toggle">
            <span>Moeda de custo</span>
            <button className={`rgb ${isBRL?"on":""}`} onClick={()=>S("moedaCusto")("BRL")}>BRL</button>
            <button className={`rgb ${!isBRL?"on":""}`} onClick={()=>S("moedaCusto")("USD")}>USD</button>
            {!isBRL&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#7a90b0",marginLeft:4}}>× {d.ptax} = BRL</span>}
          </div>
          <div className="pscroll">

          {tab==="perfil"&&<>
            <Sec title="Produto" tag="NCM / PLAN_TRIB">
              <select className="psel" value={d.prodId} onChange={e=>setProd(e.target.value)}>
                {PRODUTOS.map(p=><option key={p.id} value={p.id}>{p.ncm} -- {p.nome}</option>)}
              </select>
              <div className="pgrid">
                {[["NCM",prod.ncm],["Origem",prod.uf],["IPI",pct(prod.ipi)],
                  ["P/C Base",prod.pcBase==="zmf"?"ZFM":pct(+prod.pcBase)],
                  ["ICMS NF",pct(prod.icms)],["Cred.Pres.",pct(prod.cred)],
                  ["MVA",prod.mva>0?pct(prod.mva):"N/A"],["FTI/UEA",prod.fti>0?pct(prod.fti):"--"],
                ].map(([l,v])=>(
                  <div key={l} className="pchip"><span className="pcl">{l}</span><span className="pcv">{v}</span></div>
                ))}
              </div>
            </Sec>

            {isZFM&&prod.pcBase==="zmf"?(
              <Sec title="P/C ZFM — Regime do Comprador" tag="Lei 10.637/02">
                <Box t="blue">Regime do COMPRADOR determina a aliquota de P/C debitada pelo vendedor.</Box>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {PC_ZFM.map(e=>(
                    <div key={e.k} className={`zmfi ${d.pcZfmKey===e.k?"sel":""}`} onClick={()=>setD(p=>({...p,pcZfmKey:e.k}))}>
                      <div className={`rdot ${d.pcZfmKey===e.k?"on":""}`}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,fontWeight:600,color:d.pcZfmKey===e.k?"#93c5fd":"#94a3b8"}}>{e.label}</div>
                        <div style={{fontSize:9,color:"#475569",marginTop:2}}>{e.sub}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,color:d.pcZfmKey===e.k?"#93c5fd":"#0047BB",marginTop:3}}>
                          {e.pct===0?"Nao incidencia":pct(e.pct)+" debito vendedor"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Box t="gray"><em>{pcEntry.base}</em></Box>
              </Sec>
            ):(
              <Sec title="Regime do Vendedor" tag="P/C Saida">
                <Box t="gray">Para produtos fora da ZFM, o regime do vendedor determina a aliquota de P/C.</Box>
                <RG val={d.regimeVendedor} onChange={S("regimeVendedor")}
                  opts={[{v:"real",l:"Lucro Real — 9,25%"},{v:"presumido",l:"Lucro Presumido — 3,65%"}]}/>
              </Sec>
            )}

            <Sec title="Perfil do Comprador" tag="ICMS / DIFAL">
              <RG label="Tipo de contribuinte" val={d.tipoComprador} onChange={S("tipoComprador")}
                opts={[{v:"contrib",l:"Contribuinte ICMS"},{v:"naocontrib",l:"Nao-contribuinte"}]}/>
              {d.tipoComprador==="contrib"&&(
                <RG label="Destinacao" val={d.destinacaoCliente} onChange={S("destinacaoCliente")}
                  opts={[{v:"revenda",l:"Revenda"},{v:"imobilizado",l:"Ativo Imobilizado"}]}/>
              )}
              <Box t={c.difal>0?"warn":"ok"}>
                {d.tipoComprador==="naocontrib"?"Nao-contribuinte: vendedor recolhe DIFAL (EC 87/2015). Incluido no preco."
                  :d.destinacaoCliente==="imobilizado"?"Ativo imobilizado: vendedor recolhe DIFAL. Incluido no preco."
                  :"Revenda para contribuinte: DIFAL e responsabilidade do destinatario."}
              </Box>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <span style={{fontSize:11,fontWeight:600,color:"#94a3b8"}}>UF Destino</span>
                <select className="fsel" value={d.ufDestino} onChange={e=>S("ufDestino")(e.target.value)}>
                  {UFS.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <DR label={`ICMS ${c.ufO} -> ${d.ufDestino}`} value={pct(c.aliqInter)} bold/>
              <DR label={`ICMS interna ${d.ufDestino}`} value={pct(c.aliqDest)}/>
              {c.difal>0&&<DR label={`DIFAL (${c.ufO}->${d.ufDestino})`} value={pct(c.difal)} accent="red" bold/>}
              {c.deveDifal&&prod.aliqST>0&&c.difal===0&&(
                <Box t="ok">DIFAL zerado: diff. ({pct(c.aliqDest-c.aliqInter)}) menor que ICMS-ST ({pct(prod.aliqST)}) — ST cobre.</Box>
              )}
            </Sec>
          </>}

          {tab==="importacao"&&<>
            <Sec title="FOB + Frete em USD" tag="Conversao apos CFR">
              <Box t="blue">Conversao BRL ocorre sobre o CFR (FOB+Frete). Frete em USD antes do PTAX.</Box>
              <Field label="FOB" sfx="USD" value={d.fobUSD} onChange={S("fobUSD")}/>
              <Field label="Frete Internacional" sfx="USD" value={d.freteUSD}
                onChange={calcs.frete.applied?undefined:S("freteUSD")}
                locked={calcs.frete.applied}
                onUnlock={()=>SC("frete")({applied:false})}
                action={<button className={`cbtn ${calcs.frete.applied?"cactive":""}`}
                  title={calcs.frete.applied?"Recalcular frete ponderado":"Calcular frete ponderado por modal"}
                  onClick={()=>setModal("frete")}>+/-</button>}/>
              <DR label="CFR (FOB + Frete)" value={`${usd(c.cfrUSD)}`} bold/>
              <Field label="PTAX (cotacao venda BC)" sfx="R$/USD" value={d.ptax} onChange={S("ptax")} hint="Cotacao do dia anterior ao Registro DI"/>
              <div className="cvres">
                <span>CFR convertido (BRL)</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:700,color:"#93c5fd"}}>{brl(c.cfrBRL)}</span>
              </div>
            </Sec>

            <Sec title="Encargos de Importacao" tag="II + Despesas">
              <Field label="Aliquota II (TEC)" sfx="%" value={d.aliqII} onChange={S("aliqII")}
                note={isZFM?"II incide mesmo na ZFM — verificar portaria MDIC/SUFRAMA":undefined}/>
              <DR label="II sobre CFR" value={brl(c.iiV)} accent="red"/>
              <Field label="Seguro" sfx={sfxM} value={toDisp(d.seguroBRL)} onChange={v=>S("seguroBRL")(toStore(v))}/>

              {/* Despesas — toggle modo */}
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <div className="desp-row">
                  <span style={{fontSize:11,fontWeight:600,color:"#94a3b8"}}>Despesas de Importacao</span>
                  <div className="desp-modes">
                    <button className={`rgb ${d.despesasModo==="pct"?"on":""}`} style={{padding:"3px 8px",fontSize:9}}
                      onClick={()=>S("despesasModo")("pct")}>% CFR</button>
                    <button className={`rgb ${d.despesasModo==="manual"?"on":""}`} style={{padding:"3px 8px",fontSize:9}}
                      onClick={()=>S("despesasModo")("manual")}>R$</button>
                  </div>
                </div>
                {d.despesasModo==="pct"?(
                  <>
                    <Field label="% sobre CFR (BRL)" sfx="%" value={d.despesasPct} onChange={S("despesasPct")} hint="SISCOMEX + Despachante + Armazenagem"/>
                    <div className="pbase"><span>Despesas calculadas</span><span>{brl(c.despesas)}</span></div>
                  </>
                ):(
                  <Field label="Despesas (manual)" sfx={sfxM} value={toDisp(d.despesas)} onChange={v=>S("despesas")(toStore(v))} hint="SISCOMEX + Despachante + Armazenagem"/>
                )}
              </div>

              <Field label="Custo Financeiro de Importacao" sfx={sfxM} value={toDisp(d.cfImp)}
                onChange={calcs.cfImp.applied?undefined:v=>S("cfImp")(toStore(v))}
                locked={calcs.cfImp.applied}
                onUnlock={()=>SC("cfImp")({applied:false})}
                hint="Juros/IOF — entra no VPL"
                action={<button className={`cbtn ${calcs.cfImp.applied?"cactive":""}`}
                  title={calcs.cfImp.applied?"Recalcular custo financeiro":"Calcular custo financeiro"}
                  onClick={()=>setModal("cfImp")}>$</button>}/>
              <Field label="CRA / Creditos Fiscais" sfx={sfxM} value={toDisp(d.cra)} onChange={v=>S("cra")(toStore(v))} hint="Certificados / creditos — entram no VPL"/>
            </Sec>

            <Sec title="Resumo" hl>
              <DR label="CFR (USD->BRL)" value={brl(c.cfrBRL)}/>
              <DR label="(+) II" value={brl(c.iiV)} accent="red"/>
              <DR label="(+) Seguro" value={brl(d.seguroBRL)}/>
              <DR label={`(+) Despesas (${d.despesasModo==="pct"?pct(d.despesasPct)+" CFR":"manual"})`} value={brl(c.despesas)}/>
              <DR label="CMV Importacao" value={brl(c.cmvImp)} bold sep/>
              <DR label="VPL (base BKP)" value={brl(c.vpl)} bold accent="blue"/>
            </Sec>

            {isZFM&&<Sec title="Isencoes ZFM na Entrada" tag="Lei 8.387/91">
              <Box t="ok">{"IPI importacao = 0% (Lei 8.387/91)\nICMS importacao = 0% (Conv. ICMS 65/88)\nPIS/COFINS importacao = Suspenso (Lei 10.996/04)\n-> Sem credito nem custo na entrada ZFM"}</Box>
            </Sec>}
          </>}

          {tab==="ppb"&&<>
            <Sec title="Itens de PPB" tag="Processo Produtivo Basico">
              <Box t="blue">Marque os itens do PPB. Os valores sao incorporados ao CMV e ao VPL (base do BKP).</Box>
              {PPB_ITEMS.map(item=>(
                <div key={item.id} className="ppbi">
                  <label className="ppbc">
                    <input type="checkbox" checked={d.ppbAtivos[item.id]||false}
                      onChange={e=>setD(p=>({...p,ppbAtivos:{...p.ppbAtivos,[item.id]:e.target.checked}}))}/>
                    <span className="ppbcb"/>
                    <span style={{fontSize:11,fontWeight:600,color:d.ppbAtivos[item.id]?"#93c5fd":"#64748b",flex:1}}>{item.label}</span>
                    {item.id==="placa"&&<button className="cbtn" onClick={e=>{e.preventDefault();setModal("pcb");}}>PCB</button>}
                  </label>
                  {d.ppbAtivos[item.id]&&(
                    <div style={{padding:"6px 10px",borderTop:"1px solid #1a2233",background:"#111827"}}>
                      <Field label="Custo unitario" sfx="R$" value={d.ppbVals[item.id]||0}
                        onChange={v=>setD(p=>({...p,ppbVals:{...p.ppbVals,[item.id]:v}}))}/>
                    </div>
                  )}
                </div>
              ))}
              <div className="ppbtot"><span>Total PPB</span><span>{brl(ppbTot)}</span></div>
            </Sec>
            {isZFM&&<Sec title="FTI / UEA-AM" tag="Fundo Tecnologico">
              <Tog label={`FTI/UEA-AM ativo (${prod.fti>0?pct(prod.fti):"0% — N/A"})`}
                val={d.ftiAtivo} onChange={S("ftiAtivo")} hint="1% faturamento bruto + 10% credito estimulo"/>
              {prod.fti===0&&d.ftiAtivo&&<Box t="warn">Produto sem FTI/UEA-AM na PLAN_TRIB.</Box>}
            </Sec>}
          </>}

          {tab==="producao"&&<>
            <Sec title="Custos de Producao" tag="BRL">
              <Field label="Producao / Montagem" sfx={sfxM} value={toDisp(d.producao)} onChange={v=>S("producao")(toStore(v))}/>
              <Field label="Garantia" sfx={sfxM} value={toDisp(d.garantia)} onChange={v=>S("garantia")(toStore(v))}/>
              <Field label="Outros Custos BRL" sfx={sfxM} value={toDisp(d.outrosBRL)} onChange={v=>S("outrosBRL")(toStore(v))}/>
            </Sec>
            <Sec title="BKP — Backup de Custodia" tag="% sobre VPL" hl>
              <Box t="blue">BKP = % sobre o VPL (CFR+II+Desp+Seguro+CF+PPB+CRA).</Box>
              <DR label="VPL (base)" value={brl(c.vpl)} bold accent="blue"/>
              <Field label="BKP (%)" sfx="%" value={d.bkpPct} onChange={S("bkpPct")} hint={`= ${brl(c.bkpV)}`}/>
              <DR label="BKP (R$)" value={brl(c.bkpV)} accent="blue"/>
            </Sec>
            <Sec title="Resumo Custos" hl>
              <DR label="CMV Importacao" value={brl(c.cmvImp)}/>
              <DR label="PPB" value={brl(ppbTot)}/>
              <DR label="Producao + BRL" value={brl(d.producao+d.garantia+d.outrosBRL)}/>
              <DR label="BKP" value={brl(c.bkpV)}/>
              <DR label="CMV Total" value={brl(c.cmvTotal)} bold sep accent="blue"/>
            </Sec>
          </>}

          {tab==="indices"&&<>
            <Sec title="Indices Comerciais" tag="% sobre preco venda">
              <Box t="gray">Todos os percentuais sao calculados por dentro do preco de venda.</Box>
              {[["P&D","pd"],["Scrap","scrap"],["Royalties / Qualcomm","royal"],
              ].map(([l,k])=>(
                <Field key={k} label={l} value={d[k]} onChange={S(k)} sfx="%" hint={`aprox. ${brl(c.pSI*(d[k]/100))}`}/>
              ))}
              <Field label="Custo Financeiro (venda)" sfx="%" value={d.cfVenda}
                onChange={calcs.cfVenda.applied?undefined:S("cfVenda")}
                locked={calcs.cfVenda.applied}
                onUnlock={()=>SC("cfVenda")({applied:false})}
                hint={calcs.cfVenda.applied?`prazo ${calcs.cfVenda.prazo}d taxa ${calcs.cfVenda.taxa}% — ${brl(c.cfnV)}`:`aprox. ${brl(c.cfnV)}`}
                action={<button className={`cbtn ${calcs.cfVenda.applied?"cactive":""}`}
                  title="Calcular CF venda por prazo e taxa" onClick={()=>setModal("cfVenda")}>%</button>}/>
              {[["Frete","frete"],["Comissao","comis"],
                ["Marketing","mkt"],["Rebate","rebate"],
              ].map(([l,k])=>(
                <Field key={k} label={l} value={d[k]} onChange={S(k)} sfx="%" hint={`aprox. ${brl(c.pSI*(d[k]/100))}`}/>
              ))}
              {/* Encargos sobre comissoes = comis / 3 x 2 — fechado, calculado automaticamente */}
              <div style={{display:"flex",alignItems:"flex-start",gap:8,justifyContent:"space-between"}}>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
                  <span style={{fontSize:12,fontWeight:600,color:"#dce7f7",letterSpacing:".3px"}}>Encargos sobre comissoes</span>
                  <span style={{fontSize:10,color:"#7a90b0",fontFamily:"'DM Mono',monospace"}}>= Comissao / 3 x 2 = {pct(c.comisXPct)} — calculado automaticamente</span>
                </div>
                <div className="fw fro" style={{minWidth:115}}>
                  <span className="fpre">%</span>
                  <input type="text" readOnly value={String(+(c.comisXPct||0).toFixed(3)).replace(".",",")}
                    style={{background:"none",border:"none",outline:"none",fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:500,color:"#94a3b8",padding:"5px 8px",width:80,textAlign:"right"}}/>
                </div>
              </div>
              <DR label="Total indices" value={pct(c.indPct)} bold sep accent="blue"/>
            </Sec>
            <Sec title="Custo Fixo" tag="% sobre preco venda">
              <Box t="gray">{"Custo Fixo esta separado dos demais indices pois compoe a MC junto com a Margem Liquida.\nMC = ML + CF  |  MC = Margem de Contribuicao  |  ML = Margem Liquida"}</Box>
              <Field label="Custo Fixo" value={d.cfixo} onChange={S("cfixo")} sfx="%" hint={`aprox. ${brl(c.cfxV)}`}/>
            </Sec>
            <Sec title="Margem Liquida (ML)" hl>
              <Field label="Margem Liquida desejada" value={d.margem} onChange={S("margem")} sfx="%" hint="% sobre preco de venda (por dentro)"/>
              <DR label="MC = ML + Custo Fixo" value={pct(c.mc)} bold accent="blue"/>
            </Sec>
          </>}

          {tab==="venda"&&<>
            <Sec title="Impostos de Venda" tag="PLAN_TRIB auto">
              <Box t="blue">Aliquotas carregadas do catalogo PLAN_TRIB 09/02/2026.</Box>
              <div className="txgrid">
                {[
                  ["IPI Saida",pct(prod.ipi),prod.ipi===0],
                  ["P/C Debito",c.pcLabel,false],
                  ["P/C Ef. (base liq.)",pct(c.pcEf),false],
                  ["ICMS Destacado NF",pct(c.aliqInter),false],
                  ["Cred. Presumido",pct(prod.cred),true],
                  ["ICMS Custo Efetivo",pct(c.icmsEfPct),c.icmsEfPct===0],
                  ["DIFAL",c.difal>0?pct(c.difal):"0% — N/A",c.difal===0],
                ].map(([l,v,ok])=>(
                  <div key={l} className={`txc ${ok?"txok":"txon"}`}>
                    <div className="txl">{l}</div><div className="txv">{v}</div>
                  </div>
                ))}
                {c.ftiPct>0&&<div className="txc txon"><div className="txl">FTI/UEA-AM</div><div className="txv">{pct(c.ftiPct)}</div></div>}
                {c.fcpPct>0&&<div className="txc txwn"><div className="txl">Fundo Pobreza {d.ufDestino}</div><div className="txv">{pct(c.fcpPct)}</div></div>}
              </div>
            </Sec>
            <Sec title="P/C — Subvencao / Credito Estimulo" hl>
              <Box t="blue">{"A incidencia do ICMS (aliq. destacada na NF) reduz a base de calculo do P/C — independente do credito presumido.\nFormula: P/C efetivo = P/C nominal x (1 - ICMS incidente% - DIFAL%)"}</Box>
              <DR label="P/C nominal (debito)" value={pct(c.pcPct)}/>
              <DR label={`(-) ICMS incidente NF (${c.ufO}->${d.ufDestino})`} value={pct(c.aliqInter)} accent="red"/>
              {c.difal>0&&<DR label={`(-) DIFAL`} value={pct(c.difal)} accent="red"/>}
              <DR label="P/C efetivo no preco" value={pct(c.pcEf)} bold accent="blue" sep/>
              <DR label="Reducao de base P/C" value={pct(c.pcPct-c.pcEf)} accent="green"/>
              <DR label="Economia em R$ (vs. sem subvencao)" value={brl(c.pSI*(c.pcPct-c.pcEf)/100)} accent="green" bold/>
              <Box t={prod.cred>0?"ok":"gray"}>{prod.cred>0?`Credito presumido/estimulo: ${pct(prod.cred)} — reduz custo do ICMS, mas NAO altera a base do P/C.`:"Produto sem credito presumido cadastrado."}</Box>
            </Sec>
            <Sec title="ICMS: Destacado x Efetivo (custo)">
              <DR label={`ICMS destacado NF (${c.ufO}->${d.ufDestino})`} value={pct(c.aliqInter)}/>
              <DR label="(-) Credito presumido / estimulo" value={`(${pct(prod.cred)})`} accent="green"/>
              <DR label="ICMS custo efetivo" value={pct(c.icmsEfPct)} bold accent={c.icmsEfPct===0?"green":"warn"} sep/>
              <Box t={c.icmsEfPct===0?"ok":"warn"}>
                {c.icmsEfPct===0
                  ?`Credito presumido (${pct(prod.cred)}) absorve os ${pct(c.aliqInter)} de ICMS. Custo = 0%.\nMas os ${pct(c.aliqInter)} ainda reduzem a base do P/C (subvencao).`
                  :`Custo residual de ICMS apos credito: ${pct(c.icmsEfPct)}.\nObs: os ${pct(c.aliqInter)} cheios reduzem a base do P/C.`}
              </Box>
            </Sec>
          </>}

          {tab==="st"&&<>
            <Sec title="Substituicao Tributaria" tag="ICMS-ST">
              <Tog label="Aplicar ICMS-ST" val={d.stAtivo} onChange={S("stAtivo")}/>
              <Box t="gray">{"ST aplica para Notebooks, Smartphones, etc.\nBase ST = Preco c/IPI x (1+MVA) | ST = Base x aliq.dest - ICMS proprio"}</Box>
              {d.stAtivo&&<>
                <Field label="MVA Original" value={d.mva} onChange={S("mva")} sfx="%" hint="Protocolo/Convenio ICMS"/>
                <Field label="Aliq. Interna Destino (ST)" value={d.icmsDestST} onChange={S("icmsDestST")} sfx="%"/>
                <DR label="Base ST" value={brl(c.stBase)}/>
                <DR label="ICMS-ST" value={brl(c.stV)} bold accent="blue"/>
              </>}
            </Sec>
          </>}

          </div>
        </aside>

        <main className="pright">
          <div className="hero">
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:700,letterSpacing:2,color:"#475569",marginBottom:5}}>PRECO DE VENDA FINAL</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:52,fontWeight:800,color:"#f1f5f9",letterSpacing:-2,lineHeight:1,display:"flex",alignItems:"flex-start",gap:5}}>
                <span style={{fontSize:22,fontWeight:400,color:"#0047BB",marginTop:8}}>R$</span>{n3(c.pF)}
              </div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#475569",marginTop:5,lineHeight:1.7}}>
                Sem IPI: {brl(c.pSI)}{c.ipi>0?` — IPI: ${brl(c.ipiV)}`:""}
                {c.stV>0?` — ST: ${brl(c.stV)}`:""}
                {c.difal>0?` — DIFAL: ${brl(c.difalV)}`:""}
                {d.ptax>0?<span style={{color:"#0047BB"}}> — {usd(c.pUSD)}</span>:""}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["CARGA TRIB.",pct(c.cargaPct),"kpi-red"],["ML (Margem Liq.)",pct(c.margPct),"kpi-green"],["MC = ML+CF",pct(c.mc),""],["MARKUP",n3(c.mkp)+"x","kpi-blue"]].map(([l,v,cls])=>(
                <div key={l} className={`kpi ${cls}`}>
                  <span style={{display:"block",fontFamily:"'Barlow Condensed',sans-serif",fontSize:8,fontWeight:700,letterSpacing:1,color:"#475569",marginBottom:3}}>{l}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <RevCalc precoAlvo={d.precoAlvo} onChange={S("precoAlvo")} c={c} margem={d.margem}/>

          <BreakdownPanel c={c} d={d} prod={prod} ppbTot={ppbTot} calcs={calcs}/>
        </main>
      </div>
    </div>
    </>
  );
}

function RevCalc({precoAlvo,onChange,c,margem}){
  const [raw,setRaw]=useState(precoAlvo===0?"":String(precoAlvo).replace(".",","));
  const mr=c.margemAlvo;
  return(
    <div className="rcard">
      <div className="rlbl">PRECO ALVO -> MARGEM</div>
      <div className="rbody">
        <div className="riw">
          <span className="rpfx">R$</span>
          <input type="text" inputMode="decimal" className="ri" placeholder="Preco alvo (c/ IPI)"
            value={raw}
            onChange={e=>{const v=e.target.value;if(/^\d*[,.]?\d{0,3}$/.test(v)||v===""){setRaw(v);onChange(parse(v));}}}
            onBlur={()=>{const n=parse(raw);if(n===0)setRaw("");else setRaw(String(n).replace(".",","));}}
          />
          {precoAlvo>0&&<button className="rcl" onClick={()=>{setRaw("");onChange(0);}}>x</button>}
        </div>
        {precoAlvo>0&&mr!==null&&(
          <div className={`rres ${mr<0?"rneg":"rpos"}`}>
            <div className="rrmain"><span>Margem resultante</span><span className="rrv">{pct(mr)}</span></div>
            <div className="rrsub">
              <span>Preco s/ IPI: {brl(precoAlvo/(1+c.ipi/100))}</span>
              <span style={{color:mr>=margem?"#4ade80":"#f87171"}}>{pct(Math.abs(mr-margem))} vs. margem atual ({pct(margem)})</span>
              {mr<0&&<span style={{color:"#f87171"}}>Abaixo do custo total</span>}
            </div>
          </div>
        )}
        {precoAlvo===0&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#334155"}}>Informe um preco alvo (c/ IPI) para ver a margem resultante</span>}
      </div>
    </div>
  );
}
