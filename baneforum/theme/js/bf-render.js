"use strict";(()=>{var N=/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/,C=/^[\w-]{11}$/;function L(e){if(!e)return 0;if(/^\d+$/.test(e))return Number(e);let t=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(e);return t?Number(t[1]??0)*3600+Number(t[2]??0)*60+Number(t[3]??0):0}function q(e){let t;try{t=new URL(e.trim())}catch{return null}if(!/^https?:$/.test(t.protocol))return null;let n;if(t.hostname==="youtu.be")n=t.pathname.slice(1);else if(N.test(t.hostname)){let r=/^\/(?:shorts|live|embed|v)\/([^/]+)/.exec(t.pathname);n=r?r[1]:t.pathname==="/watch"?t.searchParams.get("v")??void 0:void 0}if(!n||!C.test(n))return null;let o=L(t.searchParams.get("t")??t.searchParams.get("start"));return{provider:"youtube",attrs:{id:n,start:String(o)}}}var c={id:"youtube",match:q,toUrl:e=>`https://www.youtube.com/watch?v=${e.id}${Number(e.start)>0?`&t=${e.start}`:""}`};function f({id:e,start:t}){let n=new URLSearchParams({autoplay:"1",rel:"0"});return Number(t)>0&&n.set("start",String(t)),`https://www.youtube-nocookie.com/embed/${e}?${n}`}var b={en:{formatting:"Formatting",message:"Message",bold:"Bold",italic:"Italic",strike:"Strikethrough",normal:"Normal text",quote:"Quote",link:"Link",attach:"Attach file",linkAddress:"Web address",linkRemove:"Remove link",linkCancel:"Cancel",linkSave:"Save",uploadRemove:"Remove",uploadCancel:"Cancel",uploading:"Uploading {name}",uploaded:"Uploaded {name}",uploadFailed:"Could not upload {name}. {message}",uploadError:"Could not upload: {message}",uploadUnavailable:"Uploading is not available here.",uploadsBusy:"Wait until the pictures have been uploaded.",attachmentMenu:"Attachment",attachmentDescription:"Description",attachmentSave:"Save",attachmentRemove:"Delete",play:"Play video",newWindow:"(opens in a new window)",attachments:"Attachments"},da:{formatting:"Formatering",message:"Besked",bold:"Fed",italic:"Kursiv",strike:"Gennemstreget",normal:"Normal tekst",quote:"Citat",link:"Link",attach:"Vedh\xE6ft fil",linkAddress:"Webadresse",linkRemove:"Fjern link",linkCancel:"Annuller",linkSave:"Gem",uploadRemove:"Fjern",uploadCancel:"Annuller",uploading:"Uploader {name}",uploaded:"{name} er uploadet",uploadFailed:"Kunne ikke uploade {name}. {message}",uploadError:"Kunne ikke uploade: {message}",uploadUnavailable:"Upload er ikke tilg\xE6ngelig her.",uploadsBusy:"Vent til billederne er uploadet.",attachmentMenu:"Vedh\xE6ftning",attachmentDescription:"Beskrivelse",attachmentSave:"Gem",attachmentRemove:"Slet",play:"Afspil video",newWindow:"(\xE5bner i et nyt vindue)",attachments:"Vedh\xE6ftede filer"}};function u(e="",t={}){return{...b.en,...b[e.slice(0,2).toLowerCase()],...t}}function h(e,t){for(let n of e.querySelectorAll("[data-label]")){let o=t[n.getAttribute("data-label")];if(o!==void 0&&(n.setAttribute("aria-label",o),n instanceof HTMLButtonElement)){let r=n.getAttribute("aria-keyshortcuts")?.replace("Control","Ctrl");n.title=r?`${o} (${r})`:o}}for(let n of e.querySelectorAll("[data-text]"))n.textContent=t[n.getAttribute("data-text")]??n.textContent}var g=`/* The video player card. Nothing is loaded from YouTube until the button is pressed.
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
`;var k=`<style>${g}</style>${y}`;var d=class extends HTMLElement{constructor(){super();let t=this.attachShadow({mode:"open"});t.innerHTML=k,h(t,u(document.documentElement.lang));let n=t.querySelector("button");n.addEventListener("click",()=>this.#e(t,n))}#e(t,n){let o=this.getAttribute("url")??this.querySelector("a")?.href??"",r=c.match(o);if(!r)return;let i=t.querySelector("template").content.cloneNode(!0).firstElementChild;i.src=f({id:r.attrs.id,start:r.attrs.start}),n.replaceWith(i),i.focus()}};function x(e){let t=e.ownerDocument??e,n=0;for(let o of e.querySelectorAll("img.postimage")){let r=o.closest("a");if(r){r.hasAttribute("target")||(r.target="_blank",r.rel="noopener noreferrer",n+=1);continue}let a=t.createElement("a");a.href=o.src,a.target="_blank",a.rel="noopener noreferrer",o.replaceWith(a),a.append(o),n+=1}for(let o of e.querySelectorAll(".inline-attachment .attachment-file")){let r=o.closest(".postbody"),a=r?.querySelector("dl.attachbox");if(!r||!(o.parentElement instanceof HTMLElement))continue;a||(a=t.createElement("dl"),a.className="attachbox",a.innerHTML="<dt></dt>",a.firstElementChild.textContent=u(t.documentElement.lang).attachments,(r.querySelector(".content")??r).after(a));let i=t.createElement("dd"),l=o.parentElement;i.append(o),a.append(i),l.classList.contains("inline-attachment")&&l.children.length===0&&l.remove(),n+=1}return n}function p(e,t={}){let n=e.ownerDocument??e,o=t.origin??n.location?.origin??"",r=t.text??u(n.documentElement.lang).newWindow,a=0;for(let i of e.querySelectorAll("a[href]:not([data-bf-external])")){let l;try{l=new URL(i.getAttribute("href"),n.baseURI)}catch{continue}if(!/^https?:$/.test(l.protocol)||l.origin===o)continue;i.setAttribute("target","_blank"),i.setAttribute("rel",[...new Set([...(i.getAttribute("rel")??"").split(/\s+/),"noopener","noreferrer"])].filter(Boolean).join(" ")),i.setAttribute("data-bf-external","");let s=n.createElement("span");s.className="bf-visually-hidden",s.textContent=` ${r}`,i.append(s),a+=1}for(let i of e.querySelectorAll('a[target="_blank"]:not([data-bf-external], [data-bf-warned])')){let l=n.createElement("span");l.className="bf-visually-hidden",l.textContent=` ${r}`,i.append(l),i.setAttribute("data-bf-warned",""),a+=1}return a}var m=Object.freeze({":-)":"\u{1F642}",":)":"\u{1F642}",":smile:":"\u{1F642}",";-)":"\u{1F609}",";)":"\u{1F609}",":wink:":"\u{1F609}",":-D":"\u{1F600}",":D":"\u{1F600}",":grin:":"\u{1F600}",":-(":"\u{1F641}",":(":"\u{1F641}",":sad:":"\u{1F641}",":-P":"\u{1F61B}",":P":"\u{1F61B}",":razz:":"\u{1F61B}",":-o":"\u{1F62E}",":o":"\u{1F62E}",":O":"\u{1F62E}",":eek:":"\u{1F62E}",":shock:":"\u{1F632}",":-?":"\u{1F615}",":?":"\u{1F615}",":???:":"\u{1F615}","8-)":"\u{1F60E}","8)":"\u{1F60E}",":cool:":"\u{1F60E}",":lol:":"\u{1F602}",":x":"\u{1F620}",":-x":"\u{1F620}",":mad:":"\u{1F620}",":oops:":"\u{1F633}",":cry:":"\u{1F62D}",":evil:":"\u{1F608}",":twisted:":"\u{1F608}",":roll:":"\u{1F644}",":!:":"\u2757",":?:":"\u2753",":idea:":"\u{1F4A1}",":arrow:":"\u27A1\uFE0F",":|":"\u{1F610}",":-|":"\u{1F610}",":mrgreen:":"\u{1F601}",":geek:":"\u{1F913}",":ugeek:":"\u{1F913}"}),v=Object.freeze({icon_e_smile:"\u{1F642}",icon_e_biggrin:"\u{1F600}",icon_e_confused:"\u{1F615}",icon_e_sad:"\u{1F641}",icon_e_surprised:"\u{1F62E}",icon_e_wink:"\u{1F609}",icon_e_geek:"\u{1F913}",icon_e_ugeek:"\u{1F913}",icon_razz:"\u{1F61B}",icon_lol:"\u{1F602}",icon_mad:"\u{1F620}",icon_cool:"\u{1F60E}",icon_cry:"\u{1F62D}",icon_evil:"\u{1F608}",icon_twisted:"\u{1F608}",icon_redface:"\u{1F633}",icon_rolleyes:"\u{1F644}",icon_neutral:"\u{1F610}",icon_arrow:"\u27A1\uFE0F",icon_idea:"\u{1F4A1}",icon_question:"\u2753",icon_exclaim:"\u2757",icon_mrgreen:"\u{1F601}",icon_eek:"\u{1F62E}",icon_surprised:"\u{1F62E}"});function R(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function w(e=m){let t=Object.keys(e).sort((o,r)=>r.length-o.length).map(R),n=new RegExp(`(?<![\\p{L}\\p{N}/:])(${t.join("|")})(?![\\p{L}\\p{N}])`,"gu");return o=>o.replace(n,r=>e[r])}function A(e,t={}){let n=t.smilies??m,o=t.images??v,r=0;for(let a of e.querySelectorAll("img.smilies, img.emoji")){let i=P(a,n,o);i!==null&&(a.replaceWith(a.ownerDocument.createTextNode(i)),r+=1)}return r}function P(e,t,n){let o=e.getAttribute("alt")??"";if(e.classList.contains("emoji")&&o!=="")return o;if(o in t)return t[o];let r=(e.getAttribute("src")??"").split("/").pop()?.replace(/\.\w+(\?.*)?$/,"");return r!==void 0&&r in n?n[r]:null}var T='a, code, pre, textarea, script, style, .codebox, [contenteditable="true"]';function _(e,t=m){let n=w(t),r=(e.ownerDocument??e).createTreeWalker(e,4),a=[];for(let i=r.nextNode();i!==null;i=r.nextNode()){if(i.parentElement?.closest(T))continue;let l=i.nodeValue??"",s=n(l);s!==l&&a.push([i,s])}for(let[i,l]of a)i.nodeValue=l;return a.length}function S(e,t,n){let o=e.createElement("bf-youtube");if(o.setAttribute("url",t),n)o.append(n);else{o.innerHTML="<a></a>";let r=o.firstElementChild;r.href=t,r.textContent=t}return o}function E(e){let t=e.ownerDocument??e,n=0;for(let o of e.querySelectorAll('span[data-s9e-mediaembed="youtube"]')){let r=c.match(o.querySelector("iframe")?.getAttribute("src")??"");r&&(o.replaceWith(S(t,c.toUrl(r.attrs),null)),n+=1)}for(let o of e.querySelectorAll("p > a[href]:only-child")){let r=o.getAttribute("href")??"",a=o.textContent?.trim()??"";(a===r||a.includes(" ... "))&&c.match(r)&&(o.replaceWith(S(t,r,o.cloneNode(!0))),n+=1)}return n}if(typeof document<"u"){customElements.get("bf-youtube")||customElements.define("bf-youtube",d),A(document);for(let e of document.querySelectorAll(".postbody"))x(e);for(let e of document.querySelectorAll(".postbody .content, .signature, .message-box"))_(e),E(e),p(e);for(let e of document.querySelectorAll(".postbody dl.attachbox"))p(e)}})();
//# sourceMappingURL=bf-render.js.map
