export default function App() {
  return (
    <div style={{background:"#1c2333",color:"#fff",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,fontFamily:"sans-serif"}}>
      <div style={{fontSize:48}}>✅</div>
      <div style={{fontSize:24,fontWeight:700}}>Deploy funcionando!</div>
      <div style={{fontSize:14,color:"#7a90b0"}}>Pipeline OK — {new Date().toLocaleString("pt-BR")}</div>
    </div>
  );
}
