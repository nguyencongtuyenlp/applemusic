/* ============================================================
   icons.js — hand-drawn SF-style SVG glyphs (original artwork)
   Usage: Icons.home, Icons.play, ... (innerHTML strings)
   ============================================================ */
(function () {
  'use strict';

  function svg(inner, vb) {
    return (
      '<svg viewBox="' + (vb || '0 0 24 24') + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner +
      '</svg>'
    );
  }
  function fsvg(inner, vb) {
    return (
      '<svg viewBox="' + (vb || '0 0 24 24') + '" fill="currentColor" aria-hidden="true">' +
      inner +
      '</svg>'
    );
  }

  window.Icons = {
    /* ---- tab bar ---- */
    home: fsvg(
      '<path d="M12 2.6 2.9 10.4c-.4.34-.16 1 .37 1h1.6v8.9c0 .94.76 1.7 1.7 1.7h4.03v-5.9c0-.66.54-1.2 1.2-1.2h.4c.66 0 1.2.54 1.2 1.2V22h4.03c.94 0 1.7-.76 1.7-1.7v-8.9h1.6c.53 0 .77-.66.37-1L12 2.6z"/>'
    ),
    discover: fsvg(
      '<rect x="3" y="3" width="8" height="8" rx="2.4"/><rect x="13" y="3" width="8" height="8" rx="2.4"/><rect x="3" y="13" width="8" height="8" rx="2.4"/><rect x="13" y="13" width="8" height="8" rx="2.4"/>'
    ),
    radio: svg(
      '<circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><path d="M8.5 15.5a5 5 0 0 1 0-7"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.8 18.2a8.8 8.8 0 0 1 0-12.4"/><path d="M18.2 5.8a8.8 8.8 0 0 1 0 12.4"/>',
      '0 0 24 24'
    ),
    library: fsvg(
      '<path d="M5 3.4c0-.6.4-1.13.99-1.3l8.5-2.0c.86-.25 1.71.4 1.71 1.3" opacity="0"/><path d="M20 3.9c0-.95-.9-1.65-1.82-1.4L8.32 5.06c-.78.2-1.32.9-1.32 1.7V16.3a3.4 3.4 0 1 0 2 3.1V9.2l9-2.4v6.6a3.4 3.4 0 1 0 2 3.1V3.9z"/>'
    ),
    search: svg('<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.6 4.6"/>'),

    /* ---- transport ---- */
    play: fsvg('<path d="M7.2 4.06c0-.93 1.02-1.5 1.81-1.02l12.1 7.06c.78.46.78 1.6 0 2.06L9.01 19.22c-.79.47-1.81-.1-1.81-1.03V4.06z"/>'),
    pause: fsvg('<rect x="5.6" y="3.2" width="4.4" height="17.6" rx="1.5"/><rect x="14" y="3.2" width="4.4" height="17.6" rx="1.5"/>'),
    fwd: fsvg('<path d="M2.5 6.27c0-.9.98-1.45 1.75-.99l8.13 4.86c.74.45.74 1.52 0 1.97l-8.13 4.86c-.77.46-1.75-.1-1.75-.99V6.27z"/><path d="M12.1 6.27c0-.9.98-1.45 1.75-.99l8.13 4.86c.74.45.74 1.52 0 1.97l-8.13 4.86c-.77.46-1.75-.1-1.75-.99V6.27z"/>'),
    rew: fsvg('<path d="M21.5 6.27c0-.9-.98-1.45-1.75-.99l-8.13 4.86c-.74.45-.74 1.52 0 1.97l8.13 4.86c.77.46 1.75-.1 1.75-.99V6.27z"/><path d="M11.9 6.27c0-.9-.98-1.45-1.75-.99l-8.13 4.86c-.74.45-.74 1.52 0 1.97l8.13 4.86c.77.46 1.75-.1 1.75-.99V6.27z"/>'),
    shuffle: svg('<path d="M3 7h2.6c1.5 0 2.9.74 3.74 1.98l3.32 6.04A4.5 4.5 0 0 0 16.4 17H21"/><path d="M3 17h2.6a4.5 4.5 0 0 0 3.74-1.98l.6-1.1"/><path d="m13.5 8.1.96-1.12A4.5 4.5 0 0 1 18.4 7H21"/><path d="m18.5 4.5 3 2.5-3 2.5"/><path d="m18.5 14.5 3 2.5-3 2.5"/>'),
    repeat: svg('<path d="M17 3.5 20 6l-3 2.5"/><path d="M4 13v-2a5 5 0 0 1 5-5h11"/><path d="M7 20.5 4 18l3-2.5"/><path d="M20 11v2a5 5 0 0 1-5 5H4"/>'),
    repeatOne: svg('<path d="M17 3.5 20 6l-3 2.5"/><path d="M4 13v-2a5 5 0 0 1 5-5h11"/><path d="M7 20.5 4 18l3-2.5"/><path d="M20 11v2a5 5 0 0 1-5 5H4"/><path d="M12 9.6v5" stroke-width="2.2"/>'),

    /* ---- library category icons ---- */
    playlist: svg('<path d="M3.5 5.5h13"/><path d="M3.5 10h13"/><path d="M3.5 14.5h7"/><path d="M20.5 5.8v9.45"/><circle cx="18.4" cy="16.3" r="2.4"/>'),
    mic: svg('<rect x="9" y="2.4" width="6" height="11" rx="3"/><path d="M5.5 11.2a6.5 6.5 0 0 0 13 0"/><path d="M12 17.7v3.4"/><path d="M8.8 21.4h6.4"/>'),
    album: svg('<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3.4"/><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none"/>'),
    note: fsvg('<path d="M9.5 3.94c0-.57.4-1.07.96-1.18l8.1-1.7A1.2 1.2 0 0 1 20 2.24V14.7a3.1 3.1 0 1 1-2-2.9V5.6l-6.5 1.38v9.92a3.1 3.1 0 1 1-2-2.9V3.94z"/>'),
    download: svg('<circle cx="12" cy="12" r="9.4"/><path d="M12 7v8"/><path d="m8.6 11.8 3.4 3.4 3.4-3.4"/>'),

    /* ---- chrome / misc ---- */
    chevR: svg('<path d="m9 5.5 6.5 6.5L9 18.5"/>', '0 0 24 24'),
    chevL: svg('<path d="M15 5.5 8.5 12 15 18.5"/>', '0 0 24 24'),
    chevDown: svg('<path d="m6 9.5 6 6 6-6"/>'),
    more: fsvg('<circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/>'),
    plus: svg('<path d="M12 4.5v15"/><path d="M4.5 12h15"/>'),
    filter: svg('<path d="M4 7h16"/><path d="M7 12h10"/><path d="M10 17h4"/>'),
    addList: svg('<path d="M3.5 6h11"/><path d="M3.5 10.5h11"/><path d="M3.5 15h6.5"/><path d="M17.5 12.5v8"/><path d="M13.5 16.5h8"/>'),
    star: fsvg('<path d="m12 2.7 2.55 5.84 6.35.6c.5.05.7.67.32 1l-4.79 4.2 1.41 6.21a.55.55 0 0 1-.82.6L12 17.9l-5.47 3.25a.55.55 0 0 1-.82-.6l1.41-6.21-4.79-4.2a.55.55 0 0 1 .32-1l6.35-.6L11.55 2.7a.55.55 0 0 1 .9 0z" transform="translate(0.45 0)" />'),
    starOutline: svg('<path d="m12 3.3 2.4 5.5 5.97.56-4.5 3.95 1.33 5.84L12 16.1l-5.2 3.05 1.33-5.84-4.5-3.95 5.97-.56L12 3.3z"/>'),
    heart: fsvg('<path d="M12 21s-7.5-4.9-9.5-9.2C.9 8.4 3.1 4.8 6.6 4.8c2.1 0 3.9 1.2 4.9 2.9a5.7 5.7 0 0 1 4.9-2.9c3.5 0 5.7 3.6 4.1 7-2 4.3-9.5 9.2-9.5 9.2z" transform="translate(0.5 0)"/>'),
    queue: svg('<path d="M3.5 6.5h17"/><path d="M3.5 12h17"/><path d="M3.5 17.5h10"/>'),
    lyrics: svg('<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3c-1.1 0-2.2-.2-3.2-.6L4 21l1.4-4.1a8 8 0 0 1-1.9-5.4A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3z"/>'),
    video: svg('<rect x="2.5" y="5" width="14" height="14" rx="3"/><path d="m16.5 10 5-3v10l-5-3z"/>'),
    airplay: svg('<path d="M5.5 17H4.2A2.2 2.2 0 0 1 2 14.8V6.2A2.2 2.2 0 0 1 4.2 4h15.6A2.2 2.2 0 0 1 22 6.2v8.6a2.2 2.2 0 0 1-2.2 2.2h-1.3"/><path d="M12 14.2l4.5 5.3a.6.6 0 0 1-.46 1H7.96a.6.6 0 0 1-.46-1L12 14.2z" fill="currentColor" stroke="none"/>'),
    volLow: fsvg('<path d="M4 9.5h2.8L11 5.8c.5-.45 1.3-.1 1.3.57v11.3c0 .66-.8 1.02-1.3.56L6.8 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/>'),
    volHigh: fsvg('<path d="M3 9.5h2.8L10 5.8c.5-.45 1.3-.1 1.3.57v11.3c0 .66-.8 1.02-1.3.56L5.8 14.5H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/><path d="M14.5 8.6a4.6 4.6 0 0 1 0 6.8" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M17.2 6a8.2 8.2 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>'),
    close: svg('<path d="m6 6 12 12"/><path d="M18 6 6 18"/>'),
    edit: svg('<path d="M14.5 4.5 19.5 9.5 8 21H3v-5L14.5 4.5z"/><path d="m12.5 6.5 5 5"/>'),
    trash: svg('<path d="M4 6.5h16"/><path d="M9 6.5V4.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v1.7"/><path d="M6.2 6.5 7 19.7c.05.84.75 1.5 1.6 1.5h6.8c.85 0 1.55-.66 1.6-1.5l.8-13.2"/>'),
    playNext: svg('<path d="M3.5 6h11"/><path d="M3.5 11h11"/><path d="M3.5 16h6"/><path d="M14.5 14.2v6.2l5-3.1-5-3.1z" fill="currentColor"/>'),
    link: svg('<path d="M10 14a4.2 4.2 0 0 0 6 0l3.2-3.2a4.24 4.24 0 1 0-6-6L11.6 6.4"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3.2 3.2a4.24 4.24 0 1 0 6 6l1.6-1.6"/>'),
    upload: svg('<path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 20h16"/>'),
    image: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.6" cy="8.6" r="1.7"/><path d="M21 15.5 16 10.5 5 21"/>'),
    pin: svg('<path d="M9.6 3h4.8a1 1 0 0 1 .78 1.63L13.5 6.6v3.4l2.7 2.5a1 1 0 0 1-.68 1.73H8.48a1 1 0 0 1-.68-1.73l2.7-2.5V6.6L8.82 4.63A1 1 0 0 1 9.6 3z"/><path d="M12 14.2V21"/>'),
    musicNoteBox: fsvg('<path d="M6.5 2h11A4.5 4.5 0 0 1 22 6.5v11a4.5 4.5 0 0 1-4.5 4.5h-11A4.5 4.5 0 0 1 2 17.5v-11A4.5 4.5 0 0 1 6.5 2zm9.2 4.1-5.5 1.17a.8.8 0 0 0-.63.78v6.1a2.2 2.2 0 1 0 1.4 2.05V10l4.4-.94v3.42a2.2 2.2 0 1 0 1.4 2.05V6.88a.8.8 0 0 0-1.07-.78z"/>'),
  };
})();
