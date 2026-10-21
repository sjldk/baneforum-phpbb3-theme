"use strict";(()=>{var N=/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/,C=/^[\w-]{11}$/;function L(e){if(!e)return 0;if(/^\d+$/.test(e))return Number(e);let t=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(e);return t?Number(t[1]??0)*3600+Number(t[2]??0)*60+Number(t[3]??0):0}function q(e){let t;try{t=new URL(e.trim())}catch{return null}if(!/^https?:$/.test(t.protocol))return null;let n;if(t.hostname==="youtu.be")n=t.pathname.slice(1);else if(N.test(t.hostname)){let o=/^\/(?:shorts|live|embed|v)\/([^/]+)/.exec(t.pathname);n=o?o[1]:t.pathname==="/watch"?t.searchParams.get("v")??void 0:void 0}if(!n||!C.test(n))return null;let r=L(t.searchParams.get("t")??t.searchParams.get("start"));return{provider:"youtube",attrs:{id:n,start:String(r)}}}var c={id:"youtube",match:q,toUrl:e=>`https://www.youtube.com/watch?v=${e.id}${Number(e.start)>0?`&t=${e.start}`:""}`};function f({id:e,start:t}){let n=new URLSearchParams({autoplay:"1",rel:"0"});return Number(t)>0&&n.set("start",String(t)),`https://www.youtube-nocookie.com/embed/${e}?${n}`}var b={en:{formatting:"Formatting",message:"Message",bold:"Bold",italic:"Italic",strike:"Strikethrough",normal:"Normal text",quote:"Quote",link:"Link",attach:"Attach file",linkAddress:"Web address",linkRemove:"Remove link",linkCancel:"Cancel",linkSave:"Save",uploadRemove:"Remove",uploadCancel:"Cancel",uploading:"Uploading {name}",uploaded:"Uploaded {name}",uploadFailed:"Could not upload {name}. {message}",uploadError:"Could not upload: {message}",uploadUnavailable:"Uploading is not available here.",uploadsBusy:"Wait until the pictures have been uploaded.",attachmentMenu:"Attachment",attachmentDescription:"Description",attachmentSave:"Save",attachmentRemove:"Delete",play:"Play video",newWindow:"(opens in a new window)",attachments:"Attachments"},da:{formatting:"Formatering",message:"Besked",bold:"Fed",italic:"Kursiv",strike:"Gennemstreget",normal:"Normal tekst",quote:"Citat",link:"Link",attach:"Vedh\xE6ft fil",linkAddress:"Webadresse",linkRemove:"Fjern link",linkCancel:"Annuller",linkSave:"Gem",uploadRemove:"Fjern",uploadCancel:"Annuller",uploading:"Uploader {name}",uploaded:"{name} er uploadet",uploadFailed:"Kunne ikke uploade {name}. {message}",uploadError:"Kunne ikke uploade: {message}",uploadUnavailable:"Upload er ikke tilg\xE6ngelig her.",uploadsBusy:"Vent til billederne er uploadet.",attachmentMenu:"Vedh\xE6ftning",attachmentDescription:"Beskrivelse",attachmentSave:"Gem",attachmentRemove:"Slet",play:"Afspil video",newWindow:"(\xE5bner i et nyt vindue)",attachments:"Vedh\xE6ftede filer"}};function u(e="",t={}){return{...b.en,...b[e.slice(0,2).toLowerCase()],...t}}function h(e,t){for(let n of e.querySelectorAll("[data-label]")){let r=t[n.getAttribute("data-label")];if(r!==void 0&&(n.setAttribute("aria-label",r),n instanceof HTMLButtonElement)){let o=n.getAttribute("aria-keyshortcuts")?.replace("Control","Ctrl");n.title=o?`${r} (${o})`:r}}for(let n of e.querySelectorAll("[data-text]"))n.textContent=t[n.getAttribute("data-text")]??n.textContent}var g=`/* The video player card. Nothing is loaded from YouTube until the button is pressed.
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
`;var k=`<style>${g}</style>${y}`;var d=class extends HTMLElement{constructor(){super();let t=this.attachShadow({mode:"open"});t.innerHTML=k,h(t,u(document.documentElement.lang));let n=t.querySelector("button");n.addEventListener("click",()=>this.#e(t,n))}#e(t,n){let r=this.getAttribute("url")??this.querySelector("a")?.href??"",o=c.match(r);if(!o)return;let a=t.querySelector("template").content.cloneNode(!0).firstElementChild;a.src=f({id:o.attrs.id,start:o.attrs.start}),n.replaceWith(a),a.focus()}};function x(e){let t=e.ownerDocument??e,n=0;for(let r of e.querySelectorAll("img.postimage")){if(r.closest("a"))continue;let o=t.createElement("a");o.href=r.src,o.target="_blank",o.rel="noopener noreferrer",r.replaceWith(o),o.append(r),n+=1}for(let r of e.querySelectorAll(".inline-attachment .attachment-file")){let o=r.closest(".postbody"),i=o?.querySelector("dl.attachbox");if(!o||!(r.parentElement instanceof HTMLElement))continue;i||(i=t.createElement("dl"),i.className="attachbox",i.innerHTML="<dt></dt>",i.firstElementChild.textContent=u(t.documentElement.lang).attachments,(o.querySelector(".content")??o).after(i));let a=t.createElement("dd"),l=r.parentElement;a.append(r),i.append(a),l.classList.contains("inline-attachment")&&l.children.length===0&&l.remove(),n+=1}return n}function p(e,t={}){let n=e.ownerDocument??e,r=t.origin??n.location?.origin??"",o=t.text??u(n.documentElement.lang).newWindow,i=0;for(let a of e.querySelectorAll("a[href]:not([data-bf-external])")){let l;try{l=new URL(a.getAttribute("href"),n.baseURI)}catch{continue}if(!/^https?:$/.test(l.protocol)||l.origin===r)continue;a.setAttribute("target","_blank"),a.setAttribute("rel",[...new Set([...(a.getAttribute("rel")??"").split(/\s+/),"noopener","noreferrer"])].filter(Boolean).join(" ")),a.setAttribute("data-bf-external","");let s=n.createElement("span");s.className="bf-visually-hidden",s.textContent=` ${o}`,a.append(s),i+=1}for(let a of e.querySelectorAll('a[target="_blank"]:not([data-bf-external], [data-bf-warned])')){let l=n.createElement("span");l.className="bf-visually-hidden",l.textContent=` ${o}`,a.append(l),a.setAttribute("data-bf-warned",""),i+=1}return i}var m=Object.freeze({":-)":"\u{1F642}",":)":"\u{1F642}",":smile:":"\u{1F642}",";-)":"\u{1F609}",";)":"\u{1F609}",":wink:":"\u{1F609}",":-D":"\u{1F600}",":D":"\u{1F600}",":grin:":"\u{1F600}",":-(":"\u{1F641}",":(":"\u{1F641}",":sad:":"\u{1F641}",":-P":"\u{1F61B}",":P":"\u{1F61B}",":razz:":"\u{1F61B}",":-o":"\u{1F62E}",":o":"\u{1F62E}",":O":"\u{1F62E}",":eek:":"\u{1F62E}",":shock:":"\u{1F632}",":-?":"\u{1F615}",":?":"\u{1F615}",":???:":"\u{1F615}","8-)":"\u{1F60E}","8)":"\u{1F60E}",":cool:":"\u{1F60E}",":lol:":"\u{1F602}",":x":"\u{1F620}",":-x":"\u{1F620}",":mad:":"\u{1F620}",":oops:":"\u{1F633}",":cry:":"\u{1F62D}",":evil:":"\u{1F608}",":twisted:":"\u{1F608}",":roll:":"\u{1F644}",":!:":"\u2757",":?:":"\u2753",":idea:":"\u{1F4A1}",":arrow:":"\u27A1\uFE0F",":|":"\u{1F610}",":-|":"\u{1F610}",":mrgreen:":"\u{1F601}",":geek:":"\u{1F913}",":ugeek:":"\u{1F913}"}),v=Object.freeze({icon_e_smile:"\u{1F642}",icon_e_biggrin:"\u{1F600}",icon_e_confused:"\u{1F615}",icon_e_sad:"\u{1F641}",icon_e_surprised:"\u{1F62E}",icon_e_wink:"\u{1F609}",icon_e_geek:"\u{1F913}",icon_e_ugeek:"\u{1F913}",icon_razz:"\u{1F61B}",icon_lol:"\u{1F602}",icon_mad:"\u{1F620}",icon_cool:"\u{1F60E}",icon_cry:"\u{1F62D}",icon_evil:"\u{1F608}",icon_twisted:"\u{1F608}",icon_redface:"\u{1F633}",icon_rolleyes:"\u{1F644}",icon_neutral:"\u{1F610}",icon_arrow:"\u27A1\uFE0F",icon_idea:"\u{1F4A1}",icon_question:"\u2753",icon_exclaim:"\u2757",icon_mrgreen:"\u{1F601}",icon_eek:"\u{1F62E}",icon_surprised:"\u{1F62E}"});function R(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function w(e=m){let t=Object.keys(e).sort((r,o)=>o.length-r.length).map(R),n=new RegExp(`(?<![\\p{L}\\p{N}/:])(${t.join("|")})(?![\\p{L}\\p{N}])`,"gu");return r=>r.replace(n,o=>e[o])}function A(e,t={}){let n=t.smilies??m,r=t.images??v,o=0;for(let i of e.querySelectorAll("img.smilies, img.emoji")){let a=P(i,n,r);a!==null&&(i.replaceWith(i.ownerDocument.createTextNode(a)),o+=1)}return o}function P(e,t,n){let r=e.getAttribute("alt")??"";if(e.classList.contains("emoji")&&r!=="")return r;if(r in t)return t[r];let o=(e.getAttribute("src")??"").split("/").pop()?.replace(/\.\w+(\?.*)?$/,"");return o!==void 0&&o in n?n[o]:null}var T='a, code, pre, textarea, script, style, .codebox, [contenteditable="true"]';function _(e,t=m){let n=w(t),o=(e.ownerDocument??e).createTreeWalker(e,4),i=[];for(let a=o.nextNode();a!==null;a=o.nextNode()){if(a.parentElement?.closest(T))continue;let l=a.nodeValue??"",s=n(l);s!==l&&i.push([a,s])}for(let[a,l]of i)a.nodeValue=l;return i.length}function S(e,t,n){let r=e.createElement("bf-youtube");if(r.setAttribute("url",t),n)r.append(n);else{r.innerHTML="<a></a>";let o=r.firstElementChild;o.href=t,o.textContent=t}return r}function E(e){let t=e.ownerDocument??e,n=0;for(let r of e.querySelectorAll('span[data-s9e-mediaembed="youtube"]')){let o=c.match(r.querySelector("iframe")?.getAttribute("src")??"");o&&(r.replaceWith(S(t,c.toUrl(o.attrs),null)),n+=1)}for(let r of e.querySelectorAll("p > a[href]:only-child")){let o=r.getAttribute("href")??"",i=r.textContent?.trim()??"";(i===o||i.includes(" ... "))&&c.match(o)&&(r.replaceWith(S(t,o,r.cloneNode(!0))),n+=1)}return n}if(typeof document<"u"){customElements.get("bf-youtube")||customElements.define("bf-youtube",d),A(document);for(let e of document.querySelectorAll(".postbody"))x(e);for(let e of document.querySelectorAll(".postbody .content, .signature, .message-box"))_(e),E(e),p(e);for(let e of document.querySelectorAll(".postbody dl.attachbox"))p(e)}})();
//# sourceMappingURL=bf-render.js.map
