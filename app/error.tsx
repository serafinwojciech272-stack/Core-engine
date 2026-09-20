"use client";
import {useEffect} from "react";
export default function Error({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error(error)},[error]);return <main className="fatal"><div><span className="tag">CORE ENGINE · RECOVERY</span><h1>Interface recovered.</h1><p>The application hit a render error. Runtime state was not modified.</p><button onClick={()=>reset()}>Retry interface</button></div></main>}
