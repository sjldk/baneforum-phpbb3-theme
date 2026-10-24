"use strict";(()=>{var N=/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/,L=/^[\w-]{11}$/;function C(e){if(!e)return 0;if(/^\d+$/.test(e))return Number(e);let t=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(e);return t?Number(t[1]??0)*3600+Number(t[2]??0)*60+Number(t[3]??0):0}function $(e){let t;try{t=new URL(e.trim())}catch{return null}if(!/^https?:$/.test(t.protocol))return null;let o;if(t.hostname==="youtu.be")o=t.pathname.slice(1);else if(N.test(t.hostname)){let n=/^\/(?:shorts|live|embed|v)\/([^/]+)/.exec(t.pathname);o=n?n[1]:t.pathname==="/watch"?t.searchParams.get("v")??void 0:void 0}if(!o||!L.test(o))return null;let r=C(t.searchParams.get("t")??t.searchParams.get("start"));return{provider:"youtube",attrs:{id:o,start:String(r)}}}var s={id:"youtube",match:$,toUrl:e=>`https://www.youtube.com/watch?v=${e.id}${Number(e.start)>0?`&t=${e.start}`:""}`};function b({id:e,start:t}){let o=new URLSearchParams({autoplay:"1",rel:"0"});return Number(t)>0&&o.set("start",String(t)),`https://www.youtube-nocookie.com/embed/${e}?${o}`}var f={en:{formatting:"Formatting",message:"Message",bold:"Bold",italic:"Italic",strike:"Strikethrough",normal:"Normal text",quote:"Quote",link:"Link",attach:"Attach file",linkAddress:"Web address",linkRemove:"Remove link",linkCancel:"Cancel",linkSave:"Save",uploadRemove:"Remove",uploadCancel:"Cancel",uploading:"Uploading {name}",uploaded:"Uploaded {name}",uploadFailed:"Could not upload {name}. {message}",uploadError:"Could not upload: {message}",uploadUnavailable:"Uploading is not available here.",uploadsBusy:"Wait until the pictures have been uploaded.",attachmentMenu:"Attachment",attachmentDescription:"Description",attachmentSave:"Save",attachmentRemove:"Delete",play:"Play video",newWindow:"(opens in a new window)",attachments:"Attachments"},da:{formatting:"Formatering",message:"Besked",bold:"Fed",italic:"Kursiv",strike:"Gennemstreget",normal:"Normal tekst",quote:"Citat",link:"Link",attach:"Vedh\xE6ft fil",linkAddress:"Webadresse",linkRemove:"Fjern link",linkCancel:"Annuller",linkSave:"Gem",uploadRemove:"Fjern",uploadCancel:"Annuller",uploading:"Uploader {name}",uploaded:"{name} er uploadet",uploadFailed:"Kunne ikke uploade {name}. {message}",uploadError:"Kunne ikke uploade: {message}",uploadUnavailable:"Upload er ikke tilg\xE6ngelig her.",uploadsBusy:"Vent til billederne er uploadet.",attachmentMenu:"Vedh\xE6ftning",attachmentDescription:"Beskrivelse",attachmentSave:"Gem",attachmentRemove:"Slet",play:"Afspil video",newWindow:"(\xE5bner i et nyt vindue)",attachments:"Vedh\xE6ftede filer"}};function u(e="",t={}){return{...f.en,...f[e.slice(0,2).toLowerCase()],...t}}function h(e,t){for(let o of e.querySelectorAll("[data-label]")){let r=t[o.getAttribute("data-label")];if(r!==void 0&&(o.setAttribute("aria-label",r),o instanceof HTMLButtonElement)){let n=o.getAttribute("aria-keyshortcuts")?.replace("Control","Ctrl");o.title=n?`${r} (${n})`:r}}for(let o of e.querySelectorAll("[data-text]"))o.textContent=t[o.getAttribute("data-text")]??o.textContent}var g=`/* The video player card. Nothing is loaded from YouTube until the button is pressed.
   Colours are --bf-* custom properties, set by the page, with defaults. */
:host {
	display: block;
	margin: 0 0 0.75em;
	border-radius: var(--bf-radius);
	background: var(--bf-youtube-bg);
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
	border-radius: var(--bf-radius) var(--bf-radius) 0 0;
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
	border-radius: var(--bf-radius) var(--bf-radius) 0 0;
}

/* The link in the post, kept so the video can be opened on YouTube. It is the footer of the card: a strip under the player,
   in the colour of the card, at least 44 pixels high. */
slot {
	display: block;
}

slot::slotted(a) {
	display: flex;
	align-items: center;
	min-block-size: var(--bf-target);
	box-sizing: border-box;
	padding: 0.5rem 0.75rem;
	border-radius: 0 0 var(--bf-radius) var(--bf-radius);
	/* A little darker than the card (6% of the text colour), so that the strip reads as a footer. */
	background: color-mix(in srgb, var(--bf-youtube-text) 6%, var(--bf-youtube-bg));
	color: var(--bf-youtube-text);
	font-size: 0.8125rem;
	overflow-wrap: anywhere;
	text-decoration: underline;
}

/* With a thumbnail (the page sets the attribute "thumb" when the picture has loaded): the picture is behind the play button, cropped to
   16:9 (the bars of the 4:3 picture fall away). The button and the words keep the colour of the card, so they can be read on any picture.
   Without it the card is as plain as before. */
:host([thumb]) button {
	background-image: var(--bf-youtube-thumb);
	background-origin: border-box;
	background-position: center;
	background-repeat: no-repeat;
	background-size: cover;
}

:host([thumb]) button svg {
	box-sizing: content-box;
	padding: 0.75rem;
	border-radius: 50%;
	background: var(--bf-youtube-bg);
}

:host([thumb]) button span {
	padding: 0.25rem 0.75rem;
	border-radius: 999px;
	background: var(--bf-youtube-bg);
}
`;var y=`<button type="button" part="play">
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>
	<span data-text="play">Play video</span>
</button>
<template>
	<iframe title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</template>
<slot></slot>
`;var k=`<style>${g}</style>${y}`;var d=class extends HTMLElement{constructor(){super();let t=this.attachShadow({mode:"open"});t.innerHTML=k,h(t,u(document.documentElement.lang));let o=t.querySelector("button");o.addEventListener("click",()=>this.#e(t,o))}#e(t,o){let r=this.getAttribute("url")??this.querySelector("a")?.href??"",n=s.match(r);if(!n)return;let i=t.querySelector("template").content.cloneNode(!0).firstElementChild;i.src=b({id:n.attrs.id,start:n.attrs.start}),o.replaceWith(i),i.focus()}};function v(e){let t=e.ownerDocument??e,o=0;for(let r of e.querySelectorAll("img.postimage")){let n=r.closest("a");if(n){n.hasAttribute("target")||(n.target="_blank",n.rel="noopener noreferrer",o+=1);continue}let a=t.createElement("a");a.href=r.src,a.target="_blank",a.rel="noopener noreferrer",r.replaceWith(a),a.append(r),o+=1}for(let r of e.querySelectorAll(".inline-attachment .attachment-file")){let n=r.closest(".postbody"),a=n?.querySelector("dl.attachbox");if(!n||!(r.parentElement instanceof HTMLElement))continue;a||(a=t.createElement("dl"),a.className="attachbox",a.innerHTML="<dt></dt>",a.firstElementChild.textContent=u(t.documentElement.lang).attachments,(n.querySelector(".content")??n).after(a));let i=t.createElement("dd"),l=r.parentElement;i.append(r),a.append(i),l.classList.contains("inline-attachment")&&l.children.length===0&&l.remove(),o+=1}return o}function m(e,t={}){let o=e.ownerDocument??e,r=t.origin??o.location?.origin??"",n=t.text??u(o.documentElement.lang).newWindow,a=0;for(let i of e.querySelectorAll("a[href]:not([data-bf-external])")){let l;try{l=new URL(i.getAttribute("href"),o.baseURI)}catch{continue}if(!/^https?:$/.test(l.protocol)||l.origin===r)continue;i.setAttribute("target","_blank"),i.setAttribute("rel",[...new Set([...(i.getAttribute("rel")??"").split(/\s+/),"noopener","noreferrer"])].filter(Boolean).join(" ")),i.setAttribute("data-bf-external","");let c=o.createElement("span");c.className="bf-visually-hidden",c.textContent=` ${n}`,i.append(c),a+=1}for(let i of e.querySelectorAll('a[target="_blank"]:not([data-bf-external], [data-bf-warned])')){let l=o.createElement("span");l.className="bf-visually-hidden",l.textContent=` ${n}`,i.append(l),i.setAttribute("data-bf-warned",""),a+=1}return a}var p=Object.freeze({":-)":"\u{1F642}",":)":"\u{1F642}",":smile:":"\u{1F642}",";-)":"\u{1F609}",";)":"\u{1F609}",":wink:":"\u{1F609}",":-D":"\u{1F600}",":D":"\u{1F600}",":grin:":"\u{1F600}",":-(":"\u{1F641}",":(":"\u{1F641}",":sad:":"\u{1F641}",":-P":"\u{1F61B}",":P":"\u{1F61B}",":razz:":"\u{1F61B}",":-o":"\u{1F62E}",":o":"\u{1F62E}",":O":"\u{1F62E}",":eek:":"\u{1F62E}",":shock:":"\u{1F632}",":-?":"\u{1F615}",":?":"\u{1F615}",":???:":"\u{1F615}","8-)":"\u{1F60E}","8)":"\u{1F60E}",":cool:":"\u{1F60E}",":lol:":"\u{1F602}",":x":"\u{1F620}",":-x":"\u{1F620}",":mad:":"\u{1F620}",":oops:":"\u{1F633}",":cry:":"\u{1F62D}",":evil:":"\u{1F608}",":twisted:":"\u{1F608}",":roll:":"\u{1F644}",":!:":"\u2757",":?:":"\u2753",":idea:":"\u{1F4A1}",":arrow:":"\u27A1\uFE0F",":|":"\u{1F610}",":-|":"\u{1F610}",":mrgreen:":"\u{1F601}",":geek:":"\u{1F913}",":ugeek:":"\u{1F913}"}),x=Object.freeze({icon_e_smile:"\u{1F642}",icon_e_biggrin:"\u{1F600}",icon_e_confused:"\u{1F615}",icon_e_sad:"\u{1F641}",icon_e_surprised:"\u{1F62E}",icon_e_wink:"\u{1F609}",icon_e_geek:"\u{1F913}",icon_e_ugeek:"\u{1F913}",icon_razz:"\u{1F61B}",icon_lol:"\u{1F602}",icon_mad:"\u{1F620}",icon_cool:"\u{1F60E}",icon_cry:"\u{1F62D}",icon_evil:"\u{1F608}",icon_twisted:"\u{1F608}",icon_redface:"\u{1F633}",icon_rolleyes:"\u{1F644}",icon_neutral:"\u{1F610}",icon_arrow:"\u27A1\uFE0F",icon_idea:"\u{1F4A1}",icon_question:"\u2753",icon_exclaim:"\u2757",icon_mrgreen:"\u{1F601}",icon_eek:"\u{1F62E}",icon_surprised:"\u{1F62E}"});function z(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function w(e=p){let t=Object.keys(e).sort((r,n)=>n.length-r.length).map(z),o=new RegExp(`(?<![\\p{L}\\p{N}/:])(${t.join("|")})(?![\\p{L}\\p{N}])`,"gu");return r=>r.replace(o,n=>e[n])}function A(e,t={}){let o=t.smilies??p,r=t.images??x,n=0;for(let a of e.querySelectorAll("img.smilies, img.emoji")){let i=P(a,o,r);i!==null&&(a.replaceWith(a.ownerDocument.createTextNode(i)),n+=1)}return n}function P(e,t,o){let r=e.getAttribute("alt")??"";if(e.classList.contains("emoji")&&r!=="")return r;if(r in t)return t[r];let n=(e.getAttribute("src")??"").split("/").pop()?.replace(/\.\w+(\?.*)?$/,"");return n!==void 0&&n in o?o[n]:null}var R='a, code, pre, textarea, script, style, .codebox, [contenteditable="true"]';function S(e,t=p){let o=w(t),n=(e.ownerDocument??e).createTreeWalker(e,4),a=[];for(let i=n.nextNode();i!==null;i=n.nextNode()){if(i.parentElement?.closest(R))continue;let l=i.nodeValue??"",c=o(l);c!==l&&a.push([i,c])}for(let[i,l]of a)i.nodeValue=l;return a.length}function _(e,t,o){let r=e.createElement("bf-youtube");if(r.setAttribute("url",t),o)r.append(o);else{r.innerHTML="<a></a>";let n=r.firstElementChild;n.href=t,n.textContent=t}return r}function E(e){let o=(e.ownerDocument??e).querySelector('meta[name="bf-youtube-thumb"]')?.getAttribute("content"),r=0;if(!o)return r;for(let n of e.querySelectorAll("bf-youtube:not([thumb])")){let a=s.match(n.getAttribute("url")??n.querySelector("a")?.href??"");if(!a)continue;let i=o.replace("AAAAAAAAAAA",a.attrs.id),l=new Image;l.addEventListener("load",()=>{n.style.setProperty("--bf-youtube-thumb",`url("${i}")`),n.setAttribute("thumb","")}),l.src=i,r+=1}return r}function q(e){let t=e.ownerDocument??e,o=0;for(let r of e.querySelectorAll('span[data-s9e-mediaembed="youtube"]')){let n=s.match(r.querySelector("iframe")?.getAttribute("src")??"");n&&(r.replaceWith(_(t,s.toUrl(n.attrs),null)),o+=1)}for(let r of e.querySelectorAll("p > a[href]:only-child")){let n=r.getAttribute("href")??"",a=r.textContent?.trim()??"";(a===n||a.includes(" ... "))&&s.match(n)&&(r.replaceWith(_(t,n,r.cloneNode(!0))),o+=1)}return o}if(typeof document<"u"){customElements.get("bf-youtube")||customElements.define("bf-youtube",d),A(document);for(let e of document.querySelectorAll(".postbody"))v(e);for(let e of document.querySelectorAll(".postbody .content, .signature, .message-box"))S(e),q(e),m(e);for(let e of document.querySelectorAll(".postbody dl.attachbox"))m(e);for(let e of document.querySelectorAll(".postprofile .bf-contact"))m(e);E(document)}})();
//# sourceMappingURL=bf-render.js.map
