"use strict";(()=>{var N=/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/,S=/^[\w-]{11}$/;function $(t){if(!t)return 0;if(/^\d+$/.test(t))return Number(t);let e=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);return e?Number(e[1]??0)*3600+Number(e[2]??0)*60+Number(e[3]??0):0}function A(t){let e;try{e=new URL(t.trim())}catch{return null}if(!/^https?:$/.test(e.protocol))return null;let o;if(e.hostname==="youtu.be")o=e.pathname.slice(1);else if(N.test(e.hostname)){let r=/^\/(?:shorts|live|embed|v)\/([^/]+)/.exec(e.pathname);o=r?r[1]:e.pathname==="/watch"?e.searchParams.get("v")??void 0:void 0}if(!o||!S.test(o))return null;let n=$(e.searchParams.get("t")??e.searchParams.get("start"));return{provider:"youtube",attrs:{id:o,start:String(n)}}}var l={id:"youtube",match:A,toUrl:t=>`https://www.youtube.com/watch?v=${t.id}${Number(t.start)>0?`&t=${t.start}`:""}`};function d({id:t,start:e}){let o=new URLSearchParams({autoplay:"1",rel:"0"});return Number(e)>0&&o.set("start",String(e)),`https://www.youtube-nocookie.com/embed/${t}?${o}`}var f=`/* The video player card. Nothing is loaded from YouTube until the button is pressed.
   Colours are --bf-* custom properties, set by the page, with defaults. */
:host {
	display: block;
	margin: 0 0 0.75em;
	--bf-youtube-bg: #132e4e;
	--bf-youtube-text: #f6f8fa;
	--bf-focus: #4e76a5;
	--bf-radius: 0.5rem;
	--bf-target: 2.75rem;
}

button {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	inline-size: 100%;
	aspect-ratio: 16 / 9;
	border: 0.15rem solid transparent;
	border-radius: var(--bf-radius);
	background: var(--bf-youtube-bg);
	color: var(--bf-youtube-text);
	cursor: pointer;
	font: inherit;
}

button svg {
	inline-size: 3.5rem;
	block-size: 3.5rem;
	fill: currentcolor;
}

button:focus-visible {
	outline: 0.15rem solid var(--bf-focus);
	outline-offset: 0.15rem;
}

iframe {
	display: block;
	inline-size: 100%;
	aspect-ratio: 16 / 9;
	border: 0;
	border-radius: var(--bf-radius);
}

/* The link in the post, kept so the video can be opened on YouTube. */
slot {
	display: block;
	margin-block-start: 0.25rem;
	overflow-wrap: anywhere;
}
`;var p=`<button type="button" part="play">
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>
	<span>Play video</span>
</button>
<template>
	<iframe title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</template>
<slot></slot>
`;var b=`<style>${f}</style>${p}`;var u=class extends HTMLElement{constructor(){super();let e=this.attachShadow({mode:"open"});e.innerHTML=b;let o=e.querySelector("button");o.addEventListener("click",()=>this.#e(e,o))}#e(e,o){let n=this.getAttribute("url")??this.querySelector("a")?.href??"",r=l.match(n);if(!r)return;let i=e.querySelector("template").content.cloneNode(!0).firstElementChild;i.src=d({id:r.attrs.id,start:r.attrs.start}),o.replaceWith(i),i.focus()}};var h={en:"(opens in a new window)",da:"(\xE5bner i et nyt vindue)"};function P(t){let e=t.documentElement.lang.slice(0,2).toLowerCase();return h[e]??h.en}function y(t,e={}){let o=t.ownerDocument??t,n=e.origin??o.location?.origin??"",r=e.text??P(o),s=0;for(let i of t.querySelectorAll("a[href]:not([data-bf-external])")){let c;try{c=new URL(i.getAttribute("href"),o.baseURI)}catch{continue}if(!/^https?:$/.test(c.protocol)||c.origin===n)continue;i.setAttribute("target","_blank"),i.setAttribute("rel",[...new Set([...(i.getAttribute("rel")??"").split(/\s+/),"noopener","noreferrer"])].filter(Boolean).join(" ")),i.setAttribute("data-bf-external","");let a=o.createElement("span");a.className="bf-visually-hidden",a.textContent=` ${r}`,i.append(a),s+=1}return s}var m=Object.freeze({":-)":"\u{1F642}",":)":"\u{1F642}",":smile:":"\u{1F642}",";-)":"\u{1F609}",";)":"\u{1F609}",":wink:":"\u{1F609}",":-D":"\u{1F600}",":D":"\u{1F600}",":grin:":"\u{1F600}",":-(":"\u{1F641}",":(":"\u{1F641}",":sad:":"\u{1F641}",":-P":"\u{1F61B}",":P":"\u{1F61B}",":razz:":"\u{1F61B}",":-o":"\u{1F62E}",":o":"\u{1F62E}",":O":"\u{1F62E}",":eek:":"\u{1F62E}",":shock:":"\u{1F632}",":-?":"\u{1F615}",":?":"\u{1F615}",":???:":"\u{1F615}","8-)":"\u{1F60E}","8)":"\u{1F60E}",":cool:":"\u{1F60E}",":lol:":"\u{1F602}",":x":"\u{1F620}",":-x":"\u{1F620}",":mad:":"\u{1F620}",":oops:":"\u{1F633}",":cry:":"\u{1F62D}",":evil:":"\u{1F608}",":twisted:":"\u{1F608}",":roll:":"\u{1F644}",":!:":"\u2757",":?:":"\u2753",":idea:":"\u{1F4A1}",":arrow:":"\u27A1\uFE0F",":|":"\u{1F610}",":-|":"\u{1F610}",":mrgreen:":"\u{1F601}",":geek:":"\u{1F913}",":ugeek:":"\u{1F913}"}),g=Object.freeze({icon_e_smile:"\u{1F642}",icon_e_biggrin:"\u{1F600}",icon_e_confused:"\u{1F615}",icon_e_sad:"\u{1F641}",icon_e_surprised:"\u{1F62E}",icon_e_wink:"\u{1F609}",icon_e_geek:"\u{1F913}",icon_e_ugeek:"\u{1F913}",icon_razz:"\u{1F61B}",icon_lol:"\u{1F602}",icon_mad:"\u{1F620}",icon_cool:"\u{1F60E}",icon_cry:"\u{1F62D}",icon_evil:"\u{1F608}",icon_twisted:"\u{1F608}",icon_redface:"\u{1F633}",icon_rolleyes:"\u{1F644}",icon_neutral:"\u{1F610}",icon_arrow:"\u27A1\uFE0F",icon_idea:"\u{1F4A1}",icon_question:"\u2753",icon_exclaim:"\u2757",icon_mrgreen:"\u{1F601}",icon_eek:"\u{1F62E}",icon_surprised:"\u{1F62E}"});function L(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function w(t=m){let e=Object.keys(t).sort((n,r)=>r.length-n.length).map(L),o=new RegExp(`(?<![\\p{L}\\p{N}/:])(${e.join("|")})(?![\\p{L}\\p{N}])`,"gu");return n=>n.replace(o,r=>t[r])}function x(t,e={}){let o=e.smilies??m,n=e.images??g,r=0;for(let s of t.querySelectorAll("img.smilies, img.emoji")){let i=T(s,o,n);i!==null&&(s.replaceWith(s.ownerDocument.createTextNode(i)),r+=1)}return r}function T(t,e,o){let n=t.getAttribute("alt")??"";if(t.classList.contains("emoji")&&n!=="")return n;if(n in e)return e[n];let r=(t.getAttribute("src")??"").split("/").pop()?.replace(/\.\w+(\?.*)?$/,"");return r!==void 0&&r in o?o[r]:null}var q='a, code, pre, textarea, script, style, .codebox, [contenteditable="true"]';function _(t,e=m){let o=w(e),r=(t.ownerDocument??t).createTreeWalker(t,4),s=[];for(let i=r.nextNode();i!==null;i=r.nextNode()){if(i.parentElement?.closest(q))continue;let c=i.nodeValue??"",a=o(c);a!==c&&s.push([i,a])}for(let[i,c]of s)i.nodeValue=c;return s.length}function v(t,e,o){let n=t.createElement("bf-youtube");if(n.setAttribute("url",e),o)n.append(o);else{n.innerHTML="<a></a>";let r=n.firstElementChild;r.href=e,r.textContent=e}return n}function k(t){let e=t.ownerDocument??t,o=0;for(let n of t.querySelectorAll('span[data-s9e-mediaembed="youtube"]')){let r=l.match(n.querySelector("iframe")?.getAttribute("src")??"");r&&(n.replaceWith(v(e,l.toUrl(r.attrs),null)),o+=1)}for(let n of t.querySelectorAll("p > a[href]:only-child")){let r=n.getAttribute("href")??"",s=n.textContent?.trim()??"";(s===r||s.includes(" ... "))&&l.match(r)&&(n.replaceWith(v(e,r,n.cloneNode(!0))),o+=1)}return o}if(typeof document<"u"){customElements.get("bf-youtube")||customElements.define("bf-youtube",u),x(document);for(let t of document.querySelectorAll(".postbody .content, .signature, .message-box"))_(t),k(t),y(t)}})();
//# sourceMappingURL=bf-render.js.map
