import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, FileText, Truck, BadgeIndianRupee, Boxes, Settings,
  Plus, Search, ArrowRight, Pencil, X, CheckCircle2, ChevronRight,
  ClipboardList, ReceiptText, PackageOpen, Eye, Printer
} from "lucide-react";
import { PRODUCTS as BASE_PRODUCTS, Product } from "./data";
import "./styles.css";

type DocType = "Challan" | "Offer" | "Invoice";
type Line = { description:string; partNo:string; hsn:string; qty:number; rate:number; discount:number; gst:number; };
type DocumentRecord = {
  id:string; type:DocType; no:string; date:string; customer:string; gstin:string;
  billingAddress:string; shippingAddress:string; stateCode:string; poNo:string; poDate:string;
  remarks:string; status:string; lines:Line[]; referenceOfferNo?:string; createdFromOfferId?:string;
};
type Screen = "dashboard" | "challans" | "offers" | "invoices" | "documents" | "items" | "settings";
type FormMode = { type:DocType; editing?:DocumentRecord; fromOffer?:DocumentRecord } | null;

const COMPANY = {
  name:"SUNRISE HEAVY MACHINE SERVICE",
  address:"RAM VATIKA, 132, DADRI, GAUTAM BUDDHA NAGAR",
  phone:"9958549552",
  email:"sunrise7480@rediffmail.com",
  gstin:"09AURPM1904AZZR",
  bank:"BANK OF INDIA",
  account:"714020110000182",
  ifsc:"BKID0007140",
  branch:"DADRI"
};

const typeMeta = {
  Challan:{label:"Delivery Challan", prefix:"PA", icon:Truck, status:"Open", tone:"blue"},
  Offer:{label:"Offer / Quotation", prefix:"SPR", icon:ClipboardList, status:"Draft", tone:"amber"},
  Invoice:{label:"Tax Invoice", prefix:"SUN", icon:ReceiptText, status:"Pending", tone:"green"}
} as const;

const money = (n:number) => "₹" + Number(n || 0).toLocaleString("en-IN", {maximumFractionDigits:2});
const today = () => new Date().toISOString().slice(0,10);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function load<T>(key:string, fallback:T):T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function totals(lines:Line[]) {
  const taxable = lines.reduce((a,l)=>a + l.qty*l.rate*(1-l.discount/100),0);
  const tax = lines.reduce((a,l)=>a + l.qty*l.rate*(1-l.discount/100)*(l.gst/100),0);
  return { taxable, tax, total: taxable+tax };
}

function SunriseLogo({compact=false}:{compact?:boolean}) {
  return <div className={"sunrise-logo "+(compact?"compact":"")}>
    <div className="sunrise-symbol" aria-label="Sunrise Heavy Machine Service logo">
      <span className="sun-core">S</span>
      <span className="sun-ray r1"></span><span className="sun-ray r2"></span><span className="sun-ray r3"></span>
      <span className="sun-ray r4"></span><span className="sun-ray r5"></span>
    </div>
    {!compact && <div className="sunrise-wordmark"><strong>SUNRISE</strong><span>HEAVY MACHINE SERVICE</span></div>}
  </div>;
}

export default function App() {
  const [screen,setScreen] = useState<Screen>("dashboard");
  const [records,setRecords] = useState<DocumentRecord[]>(()=>load("sunrise_records_v3",[]));
  const [products,setProducts] = useState<Product[]>(()=>load("sunrise_products_v3",BASE_PRODUCTS));
  const [formMode,setFormMode] = useState<FormMode>(null);
  const [itemModal,setItemModal] = useState<{index?:number; item:Product}|null>(null);
  const [previewDoc,setPreviewDoc] = useState<DocumentRecord|null>(null);

  useEffect(()=>localStorage.setItem("sunrise_records_v3",JSON.stringify(records)),[records]);
  useEffect(()=>localStorage.setItem("sunrise_products_v3",JSON.stringify(products)),[products]);

  const counts = useMemo(()=>({
    Challan:records.filter(r=>r.type==="Challan").length,
    Offer:records.filter(r=>r.type==="Offer").length,
    Invoice:records.filter(r=>r.type==="Invoice").length
  }),[records]);

  const billed = useMemo(()=>records.filter(r=>r.type==="Invoice").reduce((a,r)=>a+totals(r.lines).total,0),[records]);

  const openCreate = (type:DocType, fromOffer?:DocumentRecord) => setFormMode({type,fromOffer});
  const saveRecord = (record:DocumentRecord) => {
    setRecords(prev => {
      const exists = prev.some(x=>x.id===record.id);
      let next = exists ? prev.map(x=>x.id===record.id?record:x) : [record,...prev];
      if(record.type==="Invoice" && record.createdFromOfferId){
        next = next.map(x=>x.id===record.createdFromOfferId ? {...x,status:"Converted"} : x);
      }
      return next;
    });
    setFormMode(null);
    setScreen(record.type==="Challan"?"challans":record.type==="Offer"?"offers":"invoices");
  };

  return <div className="app-shell">
    <Sidebar screen={screen} onChange={s=>{setScreen(s);setFormMode(null)}} />
    <main className="main">
      <Topbar screen={screen} />
      <div className="page-wrap">
        {screen==="dashboard" && <Dashboard counts={counts} billed={billed} records={records} onOpen={setScreen} />}
        {screen==="challans" && <DocumentModule type="Challan" records={records} onCreate={()=>openCreate("Challan")} onEdit={r=>setFormMode({type:"Challan",editing:r})} onPreview={setPreviewDoc} />}
        {screen==="offers" && <DocumentModule type="Offer" records={records} onCreate={()=>openCreate("Offer")} onEdit={r=>setFormMode({type:"Offer",editing:r})} onPreview={setPreviewDoc} onConvert={r=>openCreate("Invoice",r)} />}
        {screen==="invoices" && <DocumentModule type="Invoice" records={records} onCreate={()=>openCreate("Invoice")} onEdit={r=>setFormMode({type:"Invoice",editing:r})} onPreview={setPreviewDoc} />}
        {screen==="documents" && <AllDocuments records={records} onGo={setScreen} />}
        {screen==="items" && <ItemMaster products={products} onAdd={()=>setItemModal({item:{description:"",partNo:"",hsn:"",salePrice:0,purchasePrice:0}})} onEdit={(item,index)=>setItemModal({item,index})} />}
        {screen==="settings" && <SettingsPanel />}
      </div>
    </main>

    {formMode && <DocumentForm
      mode={formMode}
      products={products}
      records={records}
      onClose={()=>setFormMode(null)}
      onSave={saveRecord}
    />}

    {previewDoc && <DocumentPreview doc={previewDoc} onClose={()=>setPreviewDoc(null)} />}

    {itemModal && <ItemEditor
      value={itemModal.item}
      onClose={()=>setItemModal(null)}
      onSave={item=>{
        setProducts(prev=>{
          if(itemModal.index===undefined) return [item,...prev];
          return prev.map((x,i)=>i===itemModal.index?item:x);
        });
        setItemModal(null);
      }}
    />}
  </div>;
}

function Sidebar({screen,onChange}:{screen:Screen;onChange:(s:Screen)=>void}) {
  const nav = [
    ["dashboard","Dashboard",LayoutDashboard],
    ["challans","Challans",Truck],
    ["offers","Offers",ClipboardList],
    ["invoices","Invoices",ReceiptText],
    ["documents","All Documents",FileText],
    ["items","Item Master",Boxes],
    ["settings","Settings",Settings]
  ] as const;
  return <aside className="sidebar">
    <div className="brand"><SunriseLogo compact/><div><strong>Sunrise ERP</strong><span>Heavy Machine Service</span></div></div>
    <div className="nav-section">WORKSPACE</div>
    <nav>{nav.map(([key,label,Icon])=><button key={key} className={"nav-item "+(screen===key?"active":"")} onClick={()=>onChange(key)}><Icon size={18}/><span>{label}</span></button>)}</nav>
    <div className="sidebar-card"><span>GSTIN</span><strong>{COMPANY.gstin}</strong><small>Business workspace</small></div>
    <div className="sidebar-user"><div className="avatar">AP</div><div><strong>Administrator</strong><span>Full access</span></div></div>
  </aside>;
}

function Topbar({screen}:{screen:Screen}) {
  const titles:Record<Screen,[string,string]> = {
    dashboard:["Dashboard","Business overview"],
    challans:["Challans","Create and track delivery challans"],
    offers:["Offers / Quotations","Manage offers and convert accepted offers"],
    invoices:["Invoices","Create and manage tax invoices"],
    documents:["All Documents","Unified document register"],
    items:["Item Master","Manage reusable products & services"],
    settings:["Settings","Company and document configuration"]
  };
  return <header className="topbar">
    <div><span className="eyebrow">{titles[screen][1]}</span><h1>{titles[screen][0]}</h1></div>
    <div className="top-status"><CheckCircle2 size={16}/><span>ERP UI v3</span></div>
  </header>;
}

function Dashboard({counts,billed,records,onOpen}:{counts:Record<DocType,number>;billed:number;records:DocumentRecord[];onOpen:(s:Screen)=>void}) {
  return <>
    <section className="hero">
      <div>
        <span className="hero-tag">Modern document workflow</span>
        <h2>Challan → Offer → Invoice.<br/>Connected end-to-end.</h2>
        <p>Each module has its own action, references stay connected, and accepted offers can become invoices without re-entering the same data.</p>
      </div>
      <div className="flow-card">
        <div className="flow-node"><Truck/><span>Challan</span></div><ChevronRight/>
        <div className="flow-node"><ClipboardList/><span>Offer</span></div><ChevronRight/>
        <div className="flow-node"><ReceiptText/><span>Invoice</span></div>
      </div>
    </section>
    <section className="kpi-grid">
      <Kpi title="Challans" value={String(counts.Challan)} subtitle="Delivery documents" icon={Truck} />
      <Kpi title="Offers" value={String(counts.Offer)} subtitle="Draft / accepted" icon={ClipboardList} />
      <Kpi title="Invoices" value={String(counts.Invoice)} subtitle="Tax invoices" icon={ReceiptText} />
      <Kpi title="Total billed" value={money(billed)} subtitle="From invoices" icon={BadgeIndianRupee} />
    </section>
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">RECENT ACTIVITY</span><h3>Latest documents</h3></div><button className="text-btn" onClick={()=>onOpen("documents")}>View all <ArrowRight size={15}/></button></div>
      <RecordsTable records={records.slice(0,7)} compact />
    </section>
  </>;
}

function Kpi({title,value,subtitle,icon:Icon}:{title:string;value:string;subtitle:string;icon:any}) {
  return <article className="kpi-card"><div className="kpi-icon"><Icon size={19}/></div><div><span>{title}</span><strong>{value}</strong><small>{subtitle}</small></div></article>;
}

function DocumentModule({type,records,onCreate,onEdit,onPreview,onConvert}:{type:DocType;records:DocumentRecord[];onCreate:()=>void;onEdit:(r:DocumentRecord)=>void;onPreview:(r:DocumentRecord)=>void;onConvert?:(r:DocumentRecord)=>void}) {
  const meta=typeMeta[type], Icon=meta.icon;
  const list=records.filter(r=>r.type===type);
  const [query,setQuery]=useState("");
  const filtered=list.filter(r=>(r.no+" "+r.customer+" "+(r.referenceOfferNo||"")).toLowerCase().includes(query.toLowerCase()));
  return <>
    <section className="module-head">
      <div className={"module-icon "+meta.tone}><Icon/></div>
      <div className="module-copy"><h2>{meta.label}s</h2><p>{type==="Offer"?"Create offers, track status and convert accepted offers into invoices.":type==="Challan"?"Create delivery challans with material and vehicle details.":"Create tax invoices with linked offer references and GST calculations."}</p></div>
      <button className="primary-btn" onClick={onCreate}><Plus size={17}/> Create {meta.label}</button>
    </section>
    <section className="panel">
      <div className="toolbar"><div className="search"><Search size={17}/><input placeholder={"Search "+meta.label.toLowerCase()+"..."} value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="count-chip">{filtered.length} records</div></div>
      <div className="table-scroll">
        <table><thead><tr><th>No.</th><th>Date</th><th>Customer</th>{type==="Invoice"&&<th>Offer Ref.</th>}<th>Amount</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{filtered.length?filtered.map(r=>{
          const total=totals(r.lines).total;
          return <tr key={r.id}><td><strong>{r.no}</strong></td><td>{r.date}</td><td>{r.customer}</td>{type==="Invoice"&&<td>{r.referenceOfferNo||"—"}</td>}<td>{type==="Challan"?"—":money(total)}</td><td><Status value={r.status}/></td><td><div className="row-actions"><button className="icon-btn" title="Preview" onClick={()=>onPreview(r)}><Eye size={15}/></button><button className="icon-btn" title="Edit" onClick={()=>onEdit(r)}><Pencil size={15}/></button>{type==="Offer"&&r.status!=="Converted"&&<button className="convert-btn" onClick={()=>onConvert?.(r)}>Convert to Invoice <ArrowRight size={14}/></button>}</div></td></tr>
        }):<tr><td colSpan={7}><Empty label={"No "+meta.label.toLowerCase()+" created yet."}/></td></tr>}</tbody></table>
      </div>
    </section>
  </>;
}

function AllDocuments({records,onGo}:{records:DocumentRecord[];onGo:(s:Screen)=>void}) {
  const [query,setQuery]=useState("");
  const [type,setType]=useState("");
  const filtered=records.filter(r=>(!type||r.type===type)&&(r.no+" "+r.customer).toLowerCase().includes(query.toLowerCase()));
  return <section className="panel">
    <div className="toolbar"><div className="search"><Search size={17}/><input placeholder="Search all documents..." value={query} onChange={e=>setQuery(e.target.value)}/></div><select value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option><option>Challan</option><option>Offer</option><option>Invoice</option></select></div>
    <RecordsTable records={filtered} onGo={onGo}/>
  </section>;
}

function RecordsTable({records,compact,onGo}:{records:DocumentRecord[];compact?:boolean;onGo?:(s:Screen)=>void}) {
  return <div className="table-scroll"><table><thead><tr><th>Type</th><th>No.</th><th>Customer</th><th>Date</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>
    {records.length?records.map(r=><tr key={r.id} className={onGo?"clickable":""} onClick={()=>onGo?.(r.type==="Challan"?"challans":r.type==="Offer"?"offers":"invoices")}><td><span className={"type-chip "+r.type.toLowerCase()}>{r.type}</span></td><td><strong>{r.no}</strong></td><td>{r.customer}</td><td>{r.date}</td><td>{r.referenceOfferNo||"—"}</td><td>{r.type==="Challan"?"—":money(totals(r.lines).total)}</td><td><Status value={r.status}/></td></tr>):<tr><td colSpan={7}><Empty label="No documents yet."/></td></tr>}
  </tbody></table></div>;
}

function Status({value}:{value:string}) { return <span className={"status "+value.toLowerCase().replaceAll(" ","-")}>{value}</span>; }
function Empty({label}:{label:string}) { return <div className="empty"><PackageOpen size={28}/><span>{label}</span></div>; }

function ItemMaster({products,onAdd,onEdit}:{products:Product[];onAdd:()=>void;onEdit:(p:Product,i:number)=>void}) {
  const [q,setQ]=useState("");
  const filtered=products.map((p,index)=>({p,index})).filter(({p})=>(p.description+" "+p.partNo+" "+p.hsn).toLowerCase().includes(q.toLowerCase()));
  return <>
    <section className="module-head">
      <div className="module-icon violet"><Boxes/></div>
      <div className="module-copy"><h2>Item Master</h2><p>Add and edit products used in Challan, Offer and Invoice dropdowns.</p></div>
      <button className="primary-btn" onClick={onAdd}><Plus size={17}/> Add Item</button>
    </section>
    <section className="panel">
      <div className="toolbar"><div className="search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search description, part no. or HSN..."/></div><div className="count-chip">{products.length} items</div></div>
      <div className="table-scroll"><table><thead><tr><th>Description</th><th>Part No.</th><th>HSN/SAC</th><th>Sale Price</th><th>Purchase Price</th><th></th></tr></thead><tbody>
        {filtered.map(({p,index})=><tr key={index}><td><strong>{p.description}</strong></td><td>{p.partNo||"—"}</td><td>{p.hsn}</td><td>{money(p.salePrice)}</td><td>{money(p.purchasePrice)}</td><td><button className="icon-btn" onClick={()=>onEdit(p,index)}><Pencil size={15}/></button></td></tr>)}
      </tbody></table></div>
    </section>
  </>;
}

function ItemEditor({value,onClose,onSave}:{value:Product;onClose:()=>void;onSave:(p:Product)=>void}) {
  const [item,setItem]=useState(value);
  return <div className="overlay"><div className="modal small-modal">
    <div className="modal-head"><div><span className="eyebrow">ITEM MASTER</span><h3>{value.description?"Edit Item":"Add New Item"}</h3></div><button className="close-btn" onClick={onClose}><X/></button></div>
    <div className="form-grid">
      <label className="full">Description<input value={item.description} onChange={e=>setItem({...item,description:e.target.value})}/></label>
      <label>Part No.<input value={item.partNo} onChange={e=>setItem({...item,partNo:e.target.value})}/></label>
      <label>HSN / SAC<input value={item.hsn} onChange={e=>setItem({...item,hsn:e.target.value})}/></label>
      <label>Sale Price<input type="number" value={item.salePrice} onChange={e=>setItem({...item,salePrice:+e.target.value})}/></label>
      <label>Purchase Price<input type="number" value={item.purchasePrice} onChange={e=>setItem({...item,purchasePrice:+e.target.value})}/></label>
    </div>
    <div className="modal-actions"><button className="secondary-btn" onClick={onClose}>Cancel</button><button className="primary-btn" onClick={()=>item.description&&onSave(item)}>Save Item</button></div>
  </div></div>;
}

function DocumentForm({mode,products,records,onClose,onSave}:{mode:NonNullable<FormMode>;products:Product[];records:DocumentRecord[];onClose:()=>void;onSave:(r:DocumentRecord)=>void}) {
  const meta=typeMeta[mode.type];
  const source=mode.editing || mode.fromOffer;
  const nextNo=()=>{
    const nums=records.filter(r=>r.type===mode.type).map(r=>Number(r.no.match(/(\d+)$/)?.[1]||0));
    return meta.prefix+"-"+String(Math.max(0,...nums)+1).padStart(3,"0");
  };
  const [doc,setDoc]=useState<DocumentRecord>(()=>({
    id:mode.editing?.id || uid(),
    type:mode.type,
    no:mode.editing?.no || nextNo(),
    date:mode.editing?.date || today(),
    customer:source?.customer || "",
    gstin:source?.gstin || "",
    billingAddress:source?.billingAddress || "",
    shippingAddress:source?.shippingAddress || "",
    stateCode:source?.stateCode || "",
    poNo:source?.poNo || "",
    poDate:source?.poDate || "",
    remarks:source?.remarks || "",
    status:mode.editing?.status || meta.status,
    lines:source?.lines?.map(x=>({...x})) || [{description:"",partNo:"",hsn:"",qty:1,rate:0,discount:0,gst:18}],
    referenceOfferNo: mode.type==="Invoice" ? (mode.editing?.referenceOfferNo || mode.fromOffer?.no || "") : undefined,
    createdFromOfferId: mode.type==="Invoice" ? (mode.editing?.createdFromOfferId || mode.fromOffer?.id) : undefined
  }));
  const sum=totals(doc.lines);

  const updateLine=(i:number,patch:Partial<Line>)=>setDoc({...doc,lines:doc.lines.map((l,idx)=>idx===i?{...l,...patch}:l)});
  const chooseProduct=(i:number,description:string)=>{
    const p=products.find(x=>x.description===description);
    updateLine(i,p?{description:p.description,partNo:p.partNo,hsn:p.hsn,rate:p.salePrice}:{description});
  };

  return <div className="overlay"><div className="modal doc-modal">
    <div className="modal-head sticky"><div className="modal-brand"><SunriseLogo/><div><span className="eyebrow">{mode.editing?"EDIT":"CREATE"} {meta.label.toUpperCase()}</span><h3>{mode.editing?doc.no:"New "+meta.label}</h3>{doc.referenceOfferNo&&<div className="reference-badge">Linked Offer: <strong>{doc.referenceOfferNo}</strong></div>}</div></div><button className="close-btn" onClick={onClose}><X/></button></div>
    <div className="doc-form-layout">
      <div className="doc-form">
        <FormSection number="01" title="Document details"><div className="form-grid four">
          <label>Document No.<input value={doc.no} onChange={e=>setDoc({...doc,no:e.target.value})}/></label>
          <label>Date<input type="date" value={doc.date} onChange={e=>setDoc({...doc,date:e.target.value})}/></label>
          <label>PO / Reference No.<input value={doc.poNo} onChange={e=>setDoc({...doc,poNo:e.target.value})}/></label>
          <label>PO / Reference Date<input type="date" value={doc.poDate} onChange={e=>setDoc({...doc,poDate:e.target.value})}/></label>
          {mode.type==="Invoice"&&<label className="full">Offer Reference<input value={doc.referenceOfferNo||""} placeholder="Auto-filled when converted from Offer" onChange={e=>setDoc({...doc,referenceOfferNo:e.target.value})}/></label>}
        </div></FormSection>

        <FormSection number="02" title="Customer"><div className="form-grid">
          <label>Customer Name<input value={doc.customer} onChange={e=>setDoc({...doc,customer:e.target.value})}/></label>
          <label>GSTIN<input value={doc.gstin} onChange={e=>setDoc({...doc,gstin:e.target.value})}/></label>
          <label>Billing Address<textarea value={doc.billingAddress} onChange={e=>setDoc({...doc,billingAddress:e.target.value})}/></label>
          <label>Shipping Address<textarea value={doc.shippingAddress} onChange={e=>setDoc({...doc,shippingAddress:e.target.value})}/></label>
          <label>State Code<input value={doc.stateCode} onChange={e=>setDoc({...doc,stateCode:e.target.value})}/></label>
        </div></FormSection>

        <FormSection number="03" title="Items & services" action={<button className="secondary-btn small" onClick={()=>setDoc({...doc,lines:[...doc.lines,{description:"",partNo:"",hsn:"",qty:1,rate:0,discount:0,gst:18}]})}><Plus size={15}/> Add line</button>}>
          <div className="line-table"><table><thead><tr><th>#</th><th>Item</th><th>Part No.</th><th>HSN</th><th>Qty</th>{mode.type!=="Challan"&&<><th>Rate</th><th>Disc%</th><th>GST%</th><th>Total</th></>}<th></th></tr></thead><tbody>
            {doc.lines.map((l,i)=><tr key={i}><td>{i+1}</td><td><select value={l.description} onChange={e=>chooseProduct(i,e.target.value)}><option value="">Select item...</option>{products.map((p,idx)=><option key={idx} value={p.description}>{p.description}</option>)}</select></td><td><input value={l.partNo} onChange={e=>updateLine(i,{partNo:e.target.value})}/></td><td><input value={l.hsn} onChange={e=>updateLine(i,{hsn:e.target.value})}/></td><td><input type="number" min="0" value={l.qty} onChange={e=>updateLine(i,{qty:+e.target.value})}/></td>{mode.type!=="Challan"&&<><td><input type="number" min="0" value={l.rate} onChange={e=>updateLine(i,{rate:+e.target.value})}/></td><td><input type="number" min="0" value={l.discount} onChange={e=>updateLine(i,{discount:+e.target.value})}/></td><td><select value={l.gst} onChange={e=>updateLine(i,{gst:+e.target.value})}><option>0</option><option>5</option><option>12</option><option>18</option><option>28</option></select></td><td><strong>{money(totals([l]).total)}</strong></td></>}<td><button className="icon-btn danger" onClick={()=>setDoc({...doc,lines:doc.lines.filter((_,idx)=>idx!==i)})}><X size={14}/></button></td></tr>)}
          </tbody></table></div>
        </FormSection>

        <FormSection number="04" title="Remarks"><label className="full">Remarks / Terms<textarea value={doc.remarks} onChange={e=>setDoc({...doc,remarks:e.target.value})} placeholder="Terms, warranty, delivery note or other details..."/></label></FormSection>
      </div>

      <aside className="summary-card">
        <div className="summary-company"><SunriseLogo compact/><span>SUNRISE</span></div><div className="summary-title"><div className={"summary-icon "+meta.tone}><meta.icon size={20}/></div><div><strong>{meta.label}</strong><span>{doc.no}</span></div></div>
        <div className="summary-row"><span>Customer</span><strong>{doc.customer||"—"}</strong></div>
        <div className="summary-row"><span>Line items</span><strong>{doc.lines.length}</strong></div>
        {mode.type!=="Challan"&&<><div className="summary-row"><span>Taxable</span><strong>{money(sum.taxable)}</strong></div><div className="summary-row"><span>GST</span><strong>{money(sum.tax)}</strong></div><div className="summary-total"><span>Grand Total</span><strong>{money(sum.total)}</strong></div></>}
        {doc.referenceOfferNo&&<div className="offer-link-card"><ClipboardList size={18}/><div><span>Source Offer</span><strong>{doc.referenceOfferNo}</strong></div></div>}
        <button className="primary-btn block" onClick={()=>doc.customer&&doc.lines.some(l=>l.description)&&onSave(doc)}>{mode.editing?"Update":"Save"} {meta.label}</button>
      </aside>
    </div>
  </div></div>;
}

function DocumentPreview({doc,onClose}:{doc:DocumentRecord;onClose:()=>void}) {
  const meta=typeMeta[doc.type];
  const sum=totals(doc.lines);
  return <div className="overlay preview-overlay"><div className="modal preview-modal">
    <div className="modal-head no-print"><div className="modal-brand"><SunriseLogo/><div><span className="eyebrow">DOCUMENT PREVIEW</span><h3>{meta.label} · {doc.no}</h3></div></div><button className="close-btn" onClick={onClose}><X/></button></div>
    <div className="document-sheet" id="print-document">
      <div className="doc-letterhead">
        <SunriseLogo/>
        <div className="company-meta"><strong>{COMPANY.name}</strong><span>{COMPANY.address}</span><span>GSTIN: {COMPANY.gstin} · Ph: {COMPANY.phone}</span><span>{COMPANY.email}</span></div>
      </div>
      <div className="doc-title-row"><div><span>{meta.label.toUpperCase()}</span><strong>{doc.no}</strong></div><div><span>Date</span><strong>{doc.date}</strong></div></div>
      {doc.referenceOfferNo && <div className="doc-reference">Reference Offer: <strong>{doc.referenceOfferNo}</strong></div>}
      <div className="party-grid">
        <div><span className="doc-label">BILL TO / CUSTOMER</span><strong>{doc.customer}</strong><p>{doc.billingAddress||"—"}</p><small>GSTIN: {doc.gstin||"—"} · State Code: {doc.stateCode||"—"}</small></div>
        <div><span className="doc-label">SHIP TO</span><strong>{doc.customer}</strong><p>{doc.shippingAddress||doc.billingAddress||"—"}</p><small>PO / Ref: {doc.poNo||"—"} {doc.poDate?(" · "+doc.poDate):""}</small></div>
      </div>
      <table className="print-table"><thead><tr><th>#</th><th>Description</th><th>Part No.</th><th>HSN/SAC</th><th>Qty</th>{doc.type!=="Challan"&&<><th>Rate</th><th>Disc%</th><th>GST%</th><th>Amount</th></>}</tr></thead><tbody>
        {doc.lines.map((l,i)=><tr key={i}><td>{i+1}</td><td>{l.description}</td><td>{l.partNo||"—"}</td><td>{l.hsn||"—"}</td><td>{l.qty}</td>{doc.type!=="Challan"&&<><td>{money(l.rate)}</td><td>{l.discount}%</td><td>{l.gst}%</td><td>{money(totals([l]).total)}</td></>}</tr>)}
      </tbody></table>
      {doc.type!=="Challan"&&<div className="doc-totals"><div><span>Taxable Value</span><strong>{money(sum.taxable)}</strong></div><div><span>GST</span><strong>{money(sum.tax)}</strong></div><div className="grand"><span>Grand Total</span><strong>{money(sum.total)}</strong></div></div>}
      {doc.remarks&&<div className="doc-remarks"><span className="doc-label">REMARKS / TERMS</span><p>{doc.remarks}</p></div>}
      <div className="doc-footer">
        <div><strong>Bank Details</strong><span>{COMPANY.bank} · A/C {COMPANY.account}</span><span>IFSC {COMPANY.ifsc} · {COMPANY.branch}</span></div>
        <div className="signature"><span>For {COMPANY.name}</span><strong>Authorised Signatory</strong></div>
      </div>
    </div>
    <div className="modal-actions no-print"><button className="secondary-btn" onClick={onClose}>Close</button><button className="primary-btn" onClick={()=>window.print()}><Printer size={16}/> Print / Save PDF</button></div>
  </div></div>;
}

function FormSection({number,title,children,action}:{number:string;title:string;children:any;action?:any}) {
  return <section className="form-section"><div className="section-head"><div><span className="step">{number}</span><h4>{title}</h4></div>{action}</div>{children}</section>;
}

function SettingsPanel(){
  return <div className="settings-grid">
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">COMPANY</span><h3>Company profile</h3></div></div><div className="form-grid"><label>Company<input value={COMPANY.name} readOnly/></label><label>GSTIN<input value={COMPANY.gstin} readOnly/></label><label className="full">Address<textarea value={COMPANY.address} readOnly/></label><label>Phone<input value={COMPANY.phone} readOnly/></label><label>Email<input value={COMPANY.email} readOnly/></label></div></section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">BANKING</span><h3>Bank details</h3></div></div><div className="form-grid"><label>Bank<input value={COMPANY.bank} readOnly/></label><label>Account<input value={COMPANY.account} readOnly/></label><label>IFSC<input value={COMPANY.ifsc} readOnly/></label><label>Branch<input value={COMPANY.branch} readOnly/></label></div></section>
  </div>;
}
