import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, FileText, Truck, BadgeIndianRupee, Boxes, Settings,
  Plus, Search, ArrowRight, Pencil, X, CheckCircle2, ChevronRight,
  ClipboardList, ReceiptText, PackageOpen, Eye, Printer, BarChart3, MapPin, Users, Trash2, LogOut, UserPlus, Shield, KeyRound
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { PRODUCTS as BASE_PRODUCTS, Product } from "./data";
import "./styles.css";

type DocType = "Challan" | "Offer" | "Invoice";
type Line = { description:string; partNo:string; hsn:string; qty:number; rate:number; discount:number; gst:number; };
type DocumentRecord = {
  id:string; type:DocType; no:string; date:string; customer:string; gstin:string;
  billingAddress:string; shippingAddress:string; stateCode:string; poNo:string; poDate:string;
  remarks:string; status:string; lines:Line[]; referenceOfferNo?:string; createdFromOfferId?:string;
};
type Role = "Admin" | "Manager" | "Viewer";
type UserAccount = { id:string; name:string; email:string; password:string; role:Role; active:boolean; };
type Screen = "dashboard" | "analytics" | "challans" | "offers" | "invoices" | "documents" | "items" | "users" | "settings";
type FormMode = { type:DocType; editing?:DocumentRecord; fromOffer?:DocumentRecord } | null;

const REAL_LOGO = "https://raw.githubusercontent.com/abhay-pal/sunrise_website/main/public/images/logo-transparent.png";

const GST_STATES:Record<string,string> = {
  "01":"Jammu & Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh","05":"Uttarakhand",
  "06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh","10":"Bihar","11":"Sikkim",
  "12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur","15":"Mizoram","16":"Tripura","17":"Meghalaya",
  "18":"Assam","19":"West Bengal","20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh",
  "24":"Gujarat","26":"Dadra & Nagar Haveli and Daman & Diu","27":"Maharashtra","29":"Karnataka",
  "30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu","34":"Puducherry","35":"Andaman & Nicobar Islands",
  "36":"Telangana","37":"Andhra Pradesh","38":"Ladakh"
};

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
const DEFAULT_USERS:UserAccount[] = [{id:"admin-1",name:"Administrator",email:"admin@sunrise.local",password:"Admin@123",role:"Admin",active:true}];

function can(role:Role, action:"create"|"edit"|"delete"|"users") {
  if(role==="Admin") return true;
  if(role==="Manager") return action==="create" || action==="edit";
  return false;
}

function totals(lines:Line[]) {
  const taxable = lines.reduce((a,l)=>a + l.qty*l.rate*(1-l.discount/100),0);
  const tax = lines.reduce((a,l)=>a + l.qty*l.rate*(1-l.discount/100)*(l.gst/100),0);
  return { taxable, tax, total: taxable+tax };
}

function SunriseLogo({compact=false}:{compact?:boolean}) {
  return <div className={"sunrise-logo "+(compact?"compact":"")}>
    <img src={REAL_LOGO} crossOrigin="anonymous" alt="Sunrise Heavy Machine Service" className="real-logo-img" />
  </div>;
}

export default function App() {
  const [screen,setScreen] = useState<Screen>("dashboard");
  const [records,setRecords] = useState<DocumentRecord[]>(()=>load("sunrise_records_v3",[]));
  const [products,setProducts] = useState<Product[]>(()=>load("sunrise_products_v3",BASE_PRODUCTS));
  const [formMode,setFormMode] = useState<FormMode>(null);
  const [itemModal,setItemModal] = useState<{index?:number; item:Product}|null>(null);
  const [previewDoc,setPreviewDoc] = useState<DocumentRecord|null>(null);
  const [users,setUsers] = useState<UserAccount[]>(()=>load("sunrise_users_v1",DEFAULT_USERS));
  const [session,setSession] = useState<{userId:string}|null>(()=>load("sunrise_session_v1",null));

  useEffect(()=>localStorage.setItem("sunrise_records_v3",JSON.stringify(records)),[records]);
  useEffect(()=>localStorage.setItem("sunrise_products_v3",JSON.stringify(products)),[products]);
  useEffect(()=>localStorage.setItem("sunrise_users_v1",JSON.stringify(users)),[users]);
  useEffect(()=>{ if(session) localStorage.setItem("sunrise_session_v1",JSON.stringify(session)); else localStorage.removeItem("sunrise_session_v1"); },[session]);

  const currentUser = users.find(u=>u.id===session?.userId && u.active) || null;

  const counts = useMemo(()=>({
    Challan:records.filter(r=>r.type==="Challan").length,
    Offer:records.filter(r=>r.type==="Offer").length,
    Invoice:records.filter(r=>r.type==="Invoice").length
  }),[records]);

  const billed = useMemo(()=>records.filter(r=>r.type==="Invoice").reduce((a,r)=>a+totals(r.lines).total,0),[records]);

  const openCreate = (type:DocType, fromOffer?:DocumentRecord) => {
    if(!can(currentUser.role,"create")) return;
    setFormMode({type,fromOffer});
  };
  const deleteRecord = (record:DocumentRecord) => {
    if(!can(currentUser.role,"delete")) return;
    if(window.confirm(`Delete ${record.type} ${record.no}? This cannot be undone.`)){
      setRecords(prev=>prev.filter(x=>x.id!==record.id));
    }
  };
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

  if(!currentUser) return <LoginPage users={users} onLogin={u=>setSession({userId:u.id})} />;

  return <div className="app-shell">
    <Sidebar screen={screen} role={currentUser.role} user={currentUser} onChange={s=>{setScreen(s);setFormMode(null)}} onLogout={()=>setSession(null)} />
    <main className="main">
      <Topbar screen={screen} user={currentUser} />
      <div className="page-wrap">
        {screen==="dashboard" && <Dashboard counts={counts} billed={billed} records={records} onOpen={setScreen} />}
        {screen==="analytics" && <AnalyticsDashboard records={records} />}
        {screen==="challans" && <DocumentModule type="Challan" role={currentUser.role} records={records} onCreate={()=>openCreate("Challan")} onEdit={r=>can(currentUser.role,"edit")&&setFormMode({type:"Challan",editing:r})} onDelete={deleteRecord} onPreview={setPreviewDoc} />}
        {screen==="offers" && <DocumentModule type="Offer" role={currentUser.role} records={records} onCreate={()=>openCreate("Offer")} onEdit={r=>can(currentUser.role,"edit")&&setFormMode({type:"Offer",editing:r})} onDelete={deleteRecord} onPreview={setPreviewDoc} onConvert={r=>openCreate("Invoice",r)} />}
        {screen==="invoices" && <DocumentModule type="Invoice" role={currentUser.role} records={records} onCreate={()=>openCreate("Invoice")} onEdit={r=>can(currentUser.role,"edit")&&setFormMode({type:"Invoice",editing:r})} onDelete={deleteRecord} onPreview={setPreviewDoc} />}
        {screen==="documents" && <AllDocuments records={records} onGo={setScreen} />}
        {screen==="items" && <ItemMaster role={currentUser.role} products={products} onAdd={()=>can(currentUser.role,"create")&&setItemModal({item:{description:"",partNo:"",hsn:"",salePrice:0,purchasePrice:0}})} onEdit={(item,index)=>can(currentUser.role,"edit")&&setItemModal({item,index})} />}
        {screen==="users" && currentUser.role==="Admin" && <UserManagement users={users} currentUser={currentUser} onChange={setUsers} />}
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

function Sidebar({screen,role,user,onChange,onLogout}:{screen:Screen;role:Role;user:UserAccount;onChange:(s:Screen)=>void;onLogout:()=>void}) {
  const nav = [
    ["dashboard","Dashboard",LayoutDashboard],
    ["analytics","Analysis Dashboard",BarChart3],
    ["challans","Challans",Truck],
    ["offers","Offers",ClipboardList],
    ["invoices","Invoices",ReceiptText],
    ["documents","All Documents",FileText],
    ["items","Item Master",Boxes],
    ["users","Users & Roles",Shield],
    ["settings","Settings",Settings]
  ] as const;
  return <aside className="sidebar">
    <div className="brand"><SunriseLogo compact/><div><strong>Sunrise ERP</strong><span>Heavy Machine Service</span></div></div>
    <div className="nav-section">WORKSPACE</div>
    <nav>{nav.filter(([key])=>key!=="users"||role==="Admin").map(([key,label,Icon])=><button key={key} className={"nav-item "+(screen===key?"active":"")} onClick={()=>onChange(key)}><Icon size={18}/><span>{label}</span></button>)}</nav>
    <div className="sidebar-card"><span>GSTIN</span><strong>{COMPANY.gstin}</strong><small>Business workspace</small></div>
    <div className="sidebar-user"><div className="avatar">{user.name.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()}</div><div className="sidebar-user-copy"><strong>{user.name}</strong><span>{user.role}</span></div><button className="logout-mini" title="Logout" onClick={onLogout}><LogOut size={16}/></button></div>
  </aside>;
}

function Topbar({screen,user}:{screen:Screen;user:UserAccount}) {
  const titles:Record<Screen,[string,string]> = {
    dashboard:["Dashboard","Business overview"],
    analytics:["Analysis Dashboard","Sales, customer, product and location intelligence"],
    challans:["Challans","Create and track delivery challans"],
    offers:["Offers / Quotations","Manage offers and convert accepted offers"],
    invoices:["Invoices","Create and manage tax invoices"],
    documents:["All Documents","Unified document register"],
    items:["Item Master","Manage reusable products & services"],
    users:["Users & Roles","Admin user and access management"],
    settings:["Settings","Company and document configuration"]
  };
  return <header className="topbar">
    <div><span className="eyebrow">{titles[screen][1]}</span><h1>{titles[screen][0]}</h1></div>
    <div className="top-user-chip"><div className="avatar small">{user.name.slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.role}</span></div></div>
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


function AnalyticsDashboard({records}:{records:DocumentRecord[]}) {
  const invoices=records.filter(r=>r.type==="Invoice");
  const productMap=new Map<string,{name:string;qty:number;revenue:number}>();
  const customerMap=new Map<string,{name:string;revenue:number;orders:number}>();
  const stateMap=new Map<string,{state:string;customers:Set<string>;revenue:number}>();
  const dateMap=new Map<string,{date:string;revenue:number;qty:number}>();

  invoices.forEach(inv=>{
    const invTotal=totals(inv.lines).total;
    const c=customerMap.get(inv.customer)||{name:inv.customer||"Unknown",revenue:0,orders:0};
    c.revenue+=invTotal;c.orders+=1;customerMap.set(inv.customer,c);

    const state=GST_STATES[inv.stateCode]||inv.stateCode||"Unknown";
    const s=stateMap.get(state)||{state,customers:new Set<string>(),revenue:0};
    if(inv.customer) s.customers.add(inv.customer); s.revenue+=invTotal; stateMap.set(state,s);

    const d=dateMap.get(inv.date)||{date:inv.date,revenue:0,qty:0};
    d.revenue+=invTotal;
    inv.lines.forEach(line=>{
      const p=productMap.get(line.description)||{name:line.description||"Unknown",qty:0,revenue:0};
      p.qty+=line.qty; p.revenue+=totals([line]).total; productMap.set(line.description,p);
      d.qty+=line.qty;
    });
    dateMap.set(inv.date,d);
  });

  const productData=[...productMap.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,10);
  const customerData=[...customerMap.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,10);
  const stateData=[...stateMap.values()].map(x=>({state:x.state,customers:x.customers.size,revenue:x.revenue})).sort((a,b)=>b.revenue-a.revenue);
  const dateData=[...dateMap.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const totalRevenue=invoices.reduce((a,r)=>a+totals(r.lines).total,0);
  const totalQty=invoices.reduce((a,r)=>a+r.lines.reduce((q,l)=>q+l.qty,0),0);
  const uniqueCustomers=new Set(invoices.map(x=>x.customer).filter(Boolean)).size;
  const uniqueStates=new Set(invoices.map(x=>x.stateCode).filter(Boolean)).size;

  return <>
    <section className="module-head">
      <div className="module-icon violet"><BarChart3/></div>
      <div className="module-copy"><h2>Sales Analysis Dashboard</h2><p>Invoice-based view of products, customers, customer locations and date-wise sales.</p></div>
    </section>

    <section className="kpi-grid">
      <Kpi title="Invoice Revenue" value={money(totalRevenue)} subtitle={invoices.length+" invoices"} icon={BadgeIndianRupee}/>
      <Kpi title="Units Sold" value={totalQty.toLocaleString("en-IN")} subtitle="Across invoiced products" icon={Boxes}/>
      <Kpi title="Customers" value={String(uniqueCustomers)} subtitle="Unique billed customers" icon={Users}/>
      <Kpi title="Customer States" value={String(uniqueStates)} subtitle="From GST state codes" icon={MapPin}/>
    </section>

    <div className="analytics-grid">
      <section className="panel chart-panel">
        <div className="panel-head"><div><span className="eyebrow">PRODUCT WISE</span><h3>Top products by revenue</h3></div></div>
        {productData.length?<div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={productData} margin={{top:5,right:10,left:0,bottom:45}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={70} tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={(v:any)=>money(Number(v))}/><Bar dataKey="revenue" fill="#b42318" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div>:<Empty label="Create invoices to see product analytics."/>}
      </section>

      <section className="panel chart-panel">
        <div className="panel-head"><div><span className="eyebrow">DATE WISE</span><h3>Sales trend</h3></div></div>
        {dateData.length?<div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={dateData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={(v:any)=>money(Number(v))}/><Line type="monotone" dataKey="revenue" stroke="#175cd3" strokeWidth={3} dot={{r:4}}/></LineChart></ResponsiveContainer></div>:<Empty label="No date-wise invoice sales yet."/>}
      </section>

      <section className="panel chart-panel">
        <div className="panel-head"><div><span className="eyebrow">CUSTOMER WISE</span><h3>Top customers</h3></div></div>
        <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Invoices</th><th>Revenue</th></tr></thead><tbody>{customerData.length?customerData.map(c=><tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.orders}</td><td>{money(c.revenue)}</td></tr>):<tr><td colSpan={3}><Empty label="No customer sales yet."/></td></tr>}</tbody></table></div>
      </section>

      <section className="panel chart-panel">
        <div className="panel-head"><div><span className="eyebrow">LOCATION WISE</span><h3>Customer geography</h3></div></div>
        <div className="table-scroll"><table><thead><tr><th>State</th><th>Customers</th><th>Revenue</th></tr></thead><tbody>{stateData.length?stateData.map(s=><tr key={s.state}><td><strong>{s.state}</strong></td><td>{s.customers}</td><td>{money(s.revenue)}</td></tr>):<tr><td colSpan={3}><Empty label="GST state data will appear here."/></td></tr>}</tbody></table></div>
      </section>
    </div>

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">PRODUCT SALES REGISTER</span><h3>What sold, when and how much</h3></div></div>
      <div className="table-scroll"><table><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>State</th><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>
        {invoices.flatMap(inv=>inv.lines.map((l,i)=><tr key={inv.id+"-"+i}><td>{inv.date}</td><td><strong>{inv.no}</strong></td><td>{inv.customer}</td><td>{GST_STATES[inv.stateCode]||"—"}</td><td>{l.description}</td><td>{l.qty}</td><td>{money(totals([l]).total)}</td></tr>))}
      </tbody></table></div>
    </section>
  </>;
}

function Kpi({title,value,subtitle,icon:Icon}:{title:string;value:string;subtitle:string;icon:any}) {
  return <article className="kpi-card"><div className="kpi-icon"><Icon size={19}/></div><div><span>{title}</span><strong>{value}</strong><small>{subtitle}</small></div></article>;
}

function DocumentModule({type,role,records,onCreate,onEdit,onDelete,onPreview,onConvert}:{type:DocType;role:Role;records:DocumentRecord[];onCreate:()=>void;onEdit:(r:DocumentRecord)=>void;onDelete:(r:DocumentRecord)=>void;onPreview:(r:DocumentRecord)=>void;onConvert?:(r:DocumentRecord)=>void}) {
  const meta=typeMeta[type], Icon=meta.icon;
  const list=records.filter(r=>r.type===type);
  const [query,setQuery]=useState("");
  const filtered=list.filter(r=>(r.no+" "+r.customer+" "+(r.referenceOfferNo||"")).toLowerCase().includes(query.toLowerCase()));
  return <>
    <section className="module-head">
      <div className={"module-icon "+meta.tone}><Icon/></div>
      <div className="module-copy"><h2>{meta.label}s</h2><p>{type==="Offer"?"Create offers, track status and convert accepted offers into invoices.":type==="Challan"?"Create delivery challans with material and vehicle details.":"Create tax invoices with linked offer references and GST calculations."}</p></div>
      {can(role,"create")&&<button className="primary-btn" onClick={onCreate}><Plus size={17}/> Create {meta.label}</button>}
    </section>
    <section className="panel">
      <div className="toolbar"><div className="search"><Search size={17}/><input placeholder={"Search "+meta.label.toLowerCase()+"..."} value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="count-chip">{filtered.length} records</div></div>
      <div className="table-scroll">
        <table><thead><tr><th>No.</th><th>Date</th><th>Customer</th>{type==="Invoice"&&<th>Offer Ref.</th>}<th>Amount</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{filtered.length?filtered.map(r=>{
          const total=totals(r.lines).total;
          return <tr key={r.id}><td><strong>{r.no}</strong></td><td>{r.date}</td><td>{r.customer}</td>{type==="Invoice"&&<td>{r.referenceOfferNo||"—"}</td>}<td>{type==="Challan"?"—":money(total)}</td><td><Status value={r.status}/></td><td><div className="row-actions"><button className="icon-btn" title="Preview" onClick={()=>onPreview(r)}><Eye size={15}/></button>{can(role,"edit")&&<button className="icon-btn" title="Edit" onClick={()=>onEdit(r)}><Pencil size={15}/></button>}{can(role,"delete")&&<button className="icon-btn danger" title="Delete" onClick={()=>onDelete(r)}><Trash2 size={15}/></button>}{type==="Offer"&&r.status!=="Converted"&&can(role,"create")&&<button className="convert-btn" onClick={()=>onConvert?.(r)}>Convert to Invoice <ArrowRight size={14}/></button>}</div></td></tr>
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

function ItemMaster({role,products,onAdd,onEdit}:{role:Role;products:Product[];onAdd:()=>void;onEdit:(p:Product,i:number)=>void}) {
  const [q,setQ]=useState("");
  const filtered=products.map((p,index)=>({p,index})).filter(({p})=>(p.description+" "+p.partNo+" "+p.hsn).toLowerCase().includes(q.toLowerCase()));
  return <>
    <section className="module-head">
      <div className="module-icon violet"><Boxes/></div>
      <div className="module-copy"><h2>Item Master</h2><p>Add and edit products used in Challan, Offer and Invoice dropdowns.</p></div>
      {can(role,"create")&&<button className="primary-btn" onClick={onAdd}><Plus size={17}/> Add Item</button>}
    </section>
    <section className="panel">
      <div className="toolbar"><div className="search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search description, part no. or HSN..."/></div><div className="count-chip">{products.length} items</div></div>
      <div className="table-scroll"><table><thead><tr><th>Description</th><th>Part No.</th><th>HSN/SAC</th><th>Sale Price</th><th>Purchase Price</th><th></th></tr></thead><tbody>
        {filtered.map(({p,index})=><tr key={index}><td><strong>{p.description}</strong></td><td>{p.partNo||"—"}</td><td>{p.hsn}</td><td>{money(p.salePrice)}</td><td>{money(p.purchasePrice)}</td><td>{can(role,"edit")&&<button className="icon-btn" onClick={()=>onEdit(p,index)}><Pencil size={15}/></button>}</td></tr>)}
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
          <label>GSTIN<input value={doc.gstin} onChange={e=>{
            const gst=e.target.value.toUpperCase().replace(/\s/g,"");
            const code=gst.slice(0,2);
            setDoc({...doc,gstin:gst,stateCode:GST_STATES[code]?code:doc.stateCode});
          }}/></label>
          <label>Billing Address<textarea value={doc.billingAddress} onChange={e=>setDoc({...doc,billingAddress:e.target.value})}/></label>
          <label>Shipping Address<textarea value={doc.shippingAddress} onChange={e=>setDoc({...doc,shippingAddress:e.target.value})}/></label>
          <label>State Code<input value={doc.stateCode} readOnly placeholder="Auto from GSTIN"/></label>
          <label>State / Location<input value={GST_STATES[doc.stateCode]||""} readOnly placeholder="Auto from GSTIN"/></label>
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
  const downloadPdf = async () => {
    const el=document.getElementById("print-document");
    if(!el) return;
    const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:"#ffffff"});
    const img=canvas.toDataURL("image/png");
    const pdf=new jsPDF("p","mm","a4");
    const pageW=210,pageH=297;
    const imgH=canvas.height*pageW/canvas.width;
    let heightLeft=imgH;
    let position=0;
    pdf.addImage(img,"PNG",0,position,pageW,imgH,undefined,"FAST");
    heightLeft-=pageH;
    while(heightLeft>0){
      position=heightLeft-imgH;
      pdf.addPage();
      pdf.addImage(img,"PNG",0,position,pageW,imgH,undefined,"FAST");
      heightLeft-=pageH;
    }
    pdf.save(`${doc.no}.pdf`);
  };
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
    <div className="modal-actions no-print"><button className="secondary-btn" onClick={onClose}>Close</button><button className="secondary-btn" onClick={()=>window.print()}><Printer size={16}/> Print</button><button className="primary-btn" onClick={downloadPdf}><FileText size={16}/> Download PDF</button></div>
  </div></div>;
}

function FormSection({number,title,children,action}:{number:string;title:string;children:any;action?:any}) {
  return <section className="form-section"><div className="section-head"><div><span className="step">{number}</span><h4>{title}</h4></div>{action}</div>{children}</section>;
}

function LoginPage({users,onLogin}:{users:UserAccount[];onLogin:(u:UserAccount)=>void}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const submit=(e:any)=>{
    e.preventDefault();
    const user=users.find(u=>u.active&&u.email.toLowerCase()===email.trim().toLowerCase()&&u.password===password);
    if(!user){setError("Invalid email or password.");return;}
    setError("");onLogin(user);
  };
  return <div className="login-page">
    <div className="login-visual"><SunriseLogo/><div><span className="hero-tag">SUNRISE ERP</span><h1>Business documents.<br/>Controlled access.</h1><p>Challan, quotation, invoicing and sales intelligence in one secure workspace.</p></div></div>
    <form className="login-card" onSubmit={submit}>
      <div className="login-logo"><SunriseLogo/></div>
      <span className="eyebrow">WELCOME BACK</span><h2>Sign in to ERP</h2><p>Use your assigned Sunrise ERP account.</p>
      <label>Email<input autoFocus type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" required/></label>
      <label>Password<div className="password-field"><KeyRound size={16}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required/></div></label>
      {error&&<div className="login-error">{error}</div>}
      <button className="primary-btn block" type="submit">Sign In</button>
      <div className="demo-login"><strong>First login</strong><span>admin@sunrise.local</span><span>Admin@123</span></div>
    </form>
  </div>;
}

function UserManagement({users,currentUser,onChange}:{users:UserAccount[];currentUser:UserAccount;onChange:(u:UserAccount[])=>void}) {
  const empty={name:"",email:"",password:"",role:"Viewer" as Role};
  const [form,setForm]=useState(empty);
  const addUser=(e:any)=>{
    e.preventDefault();
    if(users.some(u=>u.email.toLowerCase()===form.email.toLowerCase())){alert("Email already exists.");return;}
    onChange([...users,{id:uid(),...form,active:true}]);
    setForm(empty);
  };
  const updateUser=(id:string,patch:Partial<UserAccount>)=>onChange(users.map(u=>u.id===id?{...u,...patch}:u));
  const removeUser=(u:UserAccount)=>{
    if(u.id===currentUser.id){alert("You cannot delete your own logged-in account.");return;}
    if(window.confirm(`Delete user ${u.name}?`)) onChange(users.filter(x=>x.id!==u.id));
  };
  return <>
    <section className="module-head"><div className="module-icon violet"><Shield/></div><div className="module-copy"><h2>Users & Role Access</h2><p>Admin can create users and control their ERP permission level.</p></div></section>
    <div className="user-admin-grid">
      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow">USERS</span><h3>Active accounts</h3></div><div className="count-chip">{users.length} users</div></div>
        <div className="table-scroll"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {users.map(u=><tr key={u.id}><td><strong>{u.name}</strong></td><td>{u.email}</td><td><select value={u.role} disabled={u.id===currentUser.id} onChange={e=>updateUser(u.id,{role:e.target.value as Role})}><option>Admin</option><option>Manager</option><option>Viewer</option></select></td><td><button className={"status-toggle "+(u.active?"on":"off")} disabled={u.id===currentUser.id} onClick={()=>updateUser(u.id,{active:!u.active})}>{u.active?"Active":"Disabled"}</button></td><td>{u.id!==currentUser.id&&<button className="icon-btn danger" onClick={()=>removeUser(u)}><Trash2 size={15}/></button>}</td></tr>)}
        </tbody></table></div>
      </section>
      <form className="panel create-user-card" onSubmit={addUser}>
        <div className="panel-head"><div><span className="eyebrow">ADMIN ONLY</span><h3>Create user</h3></div><UserPlus size={20}/></div>
        <label>Full Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
        <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label>
        <label>Temporary Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} minLength={6} required/></label>
        <label>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value as Role})}><option>Admin</option><option>Manager</option><option>Viewer</option></select></label>
        <div className="role-help"><strong>Admin</strong><span>Full access + delete + user management</span><strong>Manager</strong><span>Create/edit documents and items, no delete/users</span><strong>Viewer</strong><span>Read-only access and analytics</span></div>
        <button className="primary-btn block" type="submit"><UserPlus size={16}/> Create User</button>
      </form>
    </div>
  </>;
}

function SettingsPanel(){
  return <div className="settings-grid">
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">COMPANY</span><h3>Company profile</h3></div></div><div className="form-grid"><label>Company<input value={COMPANY.name} readOnly/></label><label>GSTIN<input value={COMPANY.gstin} readOnly/></label><label className="full">Address<textarea value={COMPANY.address} readOnly/></label><label>Phone<input value={COMPANY.phone} readOnly/></label><label>Email<input value={COMPANY.email} readOnly/></label></div></section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">BANKING</span><h3>Bank details</h3></div></div><div className="form-grid"><label>Bank<input value={COMPANY.bank} readOnly/></label><label>Account<input value={COMPANY.account} readOnly/></label><label>IFSC<input value={COMPANY.ifsc} readOnly/></label><label>Branch<input value={COMPANY.branch} readOnly/></label></div></section>
  </div>;
}
