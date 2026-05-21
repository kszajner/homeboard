// Generic modal — pass in a title and a content node (or HTML string).

export function openModal({ title, content }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title || ''}">
      <div class="modal__header">
        <h2 class="modal__title">${title || ''}</h2>
        <button type="button" class="modal__close" aria-label="Zamknij">×</button>
      </div>
      <div class="modal__body"></div>
    </div>
  `;

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector('.modal__close').addEventListener('click', close);
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onEsc);
    }
  });

  const body = backdrop.querySelector('.modal__body');
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof Node) {
    body.appendChild(content);
  }

  document.body.appendChild(backdrop);
  return { close, element: backdrop };
}
