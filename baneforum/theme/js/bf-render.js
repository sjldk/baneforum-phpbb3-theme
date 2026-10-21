"use strict";(()=>{var N=/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/,C=/^[\w-]{11}$/;function E(t){if(!t)return 0;if(/^\d+$/.test(t))return Number(t);let e=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);return e?Number(e[1]??0)*3600+Number(e[2]??0)*60+Number(e[3]??0):0}function $(t){let e;try{e=new URL(t.trim())}catch{return null}if(!/^https?:$/.test(e.protocol))return null;let o;if(e.hostname==="youtu.be")o=e.pathname.slice(1);else if(N.test(e.hostname)){let r=/^\/(?:shorts|live|embed|v)\/([^/]+)/.exec(e.pathname);o=r?r[1]:e.pathname==="/watch"?e.searchParams.get("v")??void 0:void 0}if(!o||!C.test(o))return null;let n=E(e.searchParams.get("t")??e.searchParams.get("start"));return{provider:"youtube",attrs:{id:o,start:String(n)}}}var u={id:"youtube",match:$,toUrl:t=>`https://www.youtube.com/watch?v=${t.id}${Number(t.start)>0?`&t=${t.start}`:""}`};function p({id:t,start:e}){let o=new URLSearchParams({autoplay:"1",rel:"0"});return Number(e)>0&&o.set("start",String(e)),`https://www.youtube-nocookie.com/embed/${t}?${o}`}var f={en:{formatting:"Formatting",message:"Message",bold:"Bold",italic:"Italic",strike:"Strikethrough",normal:"Normal text",quote:"Quote",link:"Link",image:"Image",linkAddress:"Web address",linkRemove:"Remove link",linkCancel:"Cancel",linkSave:"Save",uploadRemove:"Remove",uploadCancel:"Cancel",uploading:"Uploading {name}",uploaded:"Uploaded {name}",uploadFailed:"Could not upload {name}. {message}",uploadError:"Could not upload: {message}",uploadUnavailable:"Uploading is not available here.",uploadsBusy:"Wait until the pictures have been uploaded.",play:"Play video",newWindow:"(opens in a new window)"},da:{formatting:"Formatering",message:"Besked",bold:"Fed",italic:"Kursiv",strike:"Gennemstreget",normal:"Normal tekst",quote:"Citat",link:"Link",image:"Billede",linkAddress:"Webadresse",linkRemove:"Fjern link",linkCancel:"Annuller",linkSave:"Gem",uploadRemove:"Fjern",uploadCancel:"Annuller",uploading:"Uploader {name}",uploaded:"{name} er uploadet",uploadFailed:"Kunne ikke uploade {name}. {message}",uploadError:"Kunne ikke uploade: {message}",uploadUnavailable:"Upload er ikke tilg\xE6ngelig her.",uploadsBusy:"Vent til billederne er uploadet.",play:"Afspil video",newWindow:"(\xE5bner i et nyt vindue)"}};function c(t="",e={}){return{...f.en,...f[t.slice(0,2).toLowerCase()],...e}}function b(t,e){for(let o of t.querySelectorAll("[data-label]")){let n=e[o.getAttribute("data-label")];if(n!==void 0&&(o.setAttribute("aria-label",n),o instanceof HTMLButtonElement)){let r=o.getAttribute("aria-keyshortcuts")?.replace("Control","Ctrl");o.title=r?`${n} (${r})`:n}}for(let o of t.querySelectorAll("[data-text]"))o.textContent=e[o.getAttribute("data-text")]??o.textContent}var g=`/* The video player card. Nothing is loaded from YouTube until the button is pressed.
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
`;var y=`<button type="button" part="play">
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>
	<span data-text="play">Play video</span>
</button>
<template>
	<iframe title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</template>
<slot></slot>
`;var h=`<style>${g}</style>${y}`;var d=class extends HTMLElement{constructor(){super();let e=this.attachShadow({mode:"open"});e.innerHTML=h,b(e,c(document.documentElement.lang));let o=e.querySelector("button");o.addEventListener("click",()=>this.#e(e,o))}#e(e,o){let n=this.getAttribute("url")??this.querySelector("a")?.href??"",r=u.match(n);if(!r)return;let i=e.querySelector("template").content.cloneNode(!0).firstElementChild;i.src=p({id:r.attrs.id,start:r.attrs.start}),o.replaceWith(i),i.focus()}};function k(t,e={}){let o=t.ownerDocument??t,n=e.origin??o.location?.origin??"",r=e.text??c(o.documentElement.lang).newWindow,a=0;for(let i of t.querySelectorAll("a[href]:not([data-bf-external])")){let l;try{l=new URL(i.getAttribute("href"),o.baseURI)}catch{continue}if(!/^https?:$/.test(l.protocol)||l.origin===n)continue;i.setAttribute("target","_blank"),i.setAttribute("rel",[...new Set([...(i.getAttribute("rel")??"").split(/\s+/),"noopener","noreferrer"])].filter(Boolean).join(" ")),i.setAttribute("data-bf-external","");let s=o.createElement("span");s.className="bf-visually-hidden",s.textContent=` ${r}`,i.append(s),a+=1}return a}var m=Object.freeze({":-)":"\u{1F642}",":)":"\u{1F642}",":smile:":"\u{1F642}",";-)":"\u{1F609}",";)":"\u{1F609}",":wink:":"\u{1F609}",":-D":"\u{1F600}",":D":"\u{1F600}",":grin:":"\u{1F600}",":-(":"\u{1F641}",":(":"\u{1F641}",":sad:":"\u{1F641}",":-P":"\u{1F61B}",":P":"\u{1F61B}",":razz:":"\u{1F61B}",":-o":"\u{1F62E}",":o":"\u{1F62E}",":O":"\u{1F62E}",":eek:":"\u{1F62E}",":shock:":"\u{1F632}",":-?":"\u{1F615}",":?":"\u{1F615}",":???:":"\u{1F615}","8-)":"\u{1F60E}","8)":"\u{1F60E}",":cool:":"\u{1F60E}",":lol:":"\u{1F602}",":x":"\u{1F620}",":-x":"\u{1F620}",":mad:":"\u{1F620}",":oops:":"\u{1F633}",":cry:":"\u{1F62D}",":evil:":"\u{1F608}",":twisted:":"\u{1F608}",":roll:":"\u{1F644}",":!:":"\u2757",":?:":"\u2753",":idea:":"\u{1F4A1}",":arrow:":"\u27A1\uFE0F",":|":"\u{1F610}",":-|":"\u{1F610}",":mrgreen:":"\u{1F601}",":geek:":"\u{1F913}",":ugeek:":"\u{1F913}"}),w=Object.freeze({icon_e_smile:"\u{1F642}",icon_e_biggrin:"\u{1F600}",icon_e_confused:"\u{1F615}",icon_e_sad:"\u{1F641}",icon_e_surprised:"\u{1F62E}",icon_e_wink:"\u{1F609}",icon_e_geek:"\u{1F913}",icon_e_ugeek:"\u{1F913}",icon_razz:"\u{1F61B}",icon_lol:"\u{1F602}",icon_mad:"\u{1F620}",icon_cool:"\u{1F60E}",icon_cry:"\u{1F62D}",icon_evil:"\u{1F608}",icon_twisted:"\u{1F608}",icon_redface:"\u{1F633}",icon_rolleyes:"\u{1F644}",icon_neutral:"\u{1F610}",icon_arrow:"\u27A1\uFE0F",icon_idea:"\u{1F4A1}",icon_question:"\u2753",icon_exclaim:"\u2757",icon_mrgreen:"\u{1F601}",icon_eek:"\u{1F62E}",icon_surprised:"\u{1F62E}"});function q(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function x(t=m){let e=Object.keys(t).sort((n,r)=>r.length-n.length).map(q),o=new RegExp(`(?<![\\p{L}\\p{N}/:])(${e.join("|")})(?![\\p{L}\\p{N}])`,"gu");return n=>n.replace(o,r=>t[r])}function v(t,e={}){let o=e.smilies??m,n=e.images??w,r=0;for(let a of t.querySelectorAll("img.smilies, img.emoji")){let i=P(a,o,n);i!==null&&(a.replaceWith(a.ownerDocument.createTextNode(i)),r+=1)}return r}function P(t,e,o){let n=t.getAttribute("alt")??"";if(t.classList.contains("emoji")&&n!=="")return n;if(n in e)return e[n];let r=(t.getAttribute("src")??"").split("/").pop()?.replace(/\.\w+(\?.*)?$/,"");return r!==void 0&&r in o?o[r]:null}var U='a, code, pre, textarea, script, style, .codebox, [contenteditable="true"]';function _(t,e=m){let o=x(e),r=(t.ownerDocument??t).createTreeWalker(t,4),a=[];for(let i=r.nextNode();i!==null;i=r.nextNode()){if(i.parentElement?.closest(U))continue;let l=i.nodeValue??"",s=o(l);s!==l&&a.push([i,s])}for(let[i,l]of a)i.nodeValue=l;return a.length}function A(t,e,o){let n=t.createElement("bf-youtube");if(n.setAttribute("url",e),o)n.append(o);else{n.innerHTML="<a></a>";let r=n.firstElementChild;r.href=e,r.textContent=e}return n}function S(t){let e=t.ownerDocument??t,o=0;for(let n of t.querySelectorAll('span[data-s9e-mediaembed="youtube"]')){let r=u.match(n.querySelector("iframe")?.getAttribute("src")??"");r&&(n.replaceWith(A(e,u.toUrl(r.attrs),null)),o+=1)}for(let n of t.querySelectorAll("p > a[href]:only-child")){let r=n.getAttribute("href")??"",a=n.textContent?.trim()??"";(a===r||a.includes(" ... "))&&u.match(r)&&(n.replaceWith(A(e,r,n.cloneNode(!0))),o+=1)}return o}if(typeof document<"u"){customElements.get("bf-youtube")||customElements.define("bf-youtube",d),v(document);for(let t of document.querySelectorAll(".postbody .content, .signature, .message-box"))_(t),S(t),k(t)}})();
//# sourceMappingURL=bf-render.js.map
