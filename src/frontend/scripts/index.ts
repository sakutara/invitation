import { initParallax } from './parallax';
import { initReveal } from './reveal';
import { initMapPopup } from './map-popup';

document.documentElement.classList.remove('no-js');
initParallax();
initReveal();
initMapPopup();
