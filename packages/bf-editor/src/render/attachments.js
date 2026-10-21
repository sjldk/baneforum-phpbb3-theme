// Saved posts, two things about attached files:
//   - a picture that is not in a link opens whole in a new tab when it is clicked (a `[img]` picture)
//   - a file that was placed in the text (an old post, `[attachment=1]manual.pdf[/attachment]`) moves
//     to the list of files under the post, so every file is in the same place
import { labelsFor } from '../labels.js';

/**
 * @param {ParentNode} root  the part of the page to look in, one post
 * @returns {number} how many things were changed
 */
export function useAttachmentList(root) {
	const document = root.ownerDocument ?? /** @type {Document} */ (root);
	let changed = 0;

	for (const image of root.querySelectorAll(`img.postimage`)) {
		if (image.closest(`a`)) {
			continue;
		}

		const link = document.createElement(`a`);
		link.href = /** @type {HTMLImageElement} */ (image).src;
		link.target = `_blank`;
		link.rel = `noopener noreferrer`;
		image.replaceWith(link);
		link.append(image);
		changed += 1;
	}

	for (const file of root.querySelectorAll(`.inline-attachment .attachment-file`)) {
		const post = file.closest(`.postbody`);
		let list = post?.querySelector(`dl.attachbox`);

		if (!post || !(file.parentElement instanceof HTMLElement)) {
			continue;
		}

		if (!list) {
			list = document.createElement(`dl`);
			list.className = `attachbox`;
			list.innerHTML = `<dt></dt>`;
			/** @type {Element} */ (list.firstElementChild).textContent = labelsFor(
				document.documentElement.lang,
			).attachments;
			(post.querySelector(`.content`) ?? post).after(list);
		}

		const item = document.createElement(`dd`);
		const holder = file.parentElement;
		item.append(file);
		list.append(item);

		if (holder.classList.contains(`inline-attachment`) && holder.children.length === 0) {
			holder.remove();
		}

		changed += 1;
	}

	return changed;
}
