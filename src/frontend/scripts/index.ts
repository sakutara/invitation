import { initParallax } from './parallax';
import { initReveal } from './reveal';
import { initMapPopup } from './map-popup';
import { initEnvelopePage } from './envelope-page';

document.documentElement.classList.remove('no-js');
initParallax();
initEnvelopePage();
initReveal();
initMapPopup();
