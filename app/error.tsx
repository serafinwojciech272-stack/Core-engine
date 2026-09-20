"use client";
import {useEffect} from "react";
import {RefreshCw,ShieldAlert} from "lucide-react";
export default function Error({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error("[core-engine] UI error",error)},[error]);
  return <main className="error-boundary"><div><ShieldAlert size={34}/><span className="tag">RUNTIME GUARD</span><h1>Engine interface hit a recoverable error.</h1><p>The application state was not intentionally modified. Retry the interface and continue.</p><button className="primary" onClick={()=>reset()}><RefreshCw size={16}/> Retry interface</button></div></main>;
}