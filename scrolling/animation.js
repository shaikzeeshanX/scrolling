const imagePlanes = [...document.querySelectorAll('.image-plane')];
const sequence = document.querySelector('.sequence');
const snowLayer = document.querySelector('#snow-layer');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const duration = 10000;
const loginForm = document.querySelector('#login-form');
const passwordInput = document.querySelector('#login-password');
const passwordToggle = document.querySelector('#password-toggle');
const loginFeedback = document.querySelector('#login-feedback');

const snowFlakes = [];
let amount = 0;
let targetAmount = 0;
let renderFrame = 0;
let scrollEaseFrame = 0;
let playbackFrame = 0;
let playbackStart = 0;
let autoplay = false;

function buildSnowField() {
	if (!snowLayer) return;

	snowLayer.replaceChildren();
	for (let index = 0; index < 100; index += 1) {
		const flake = document.createElement('span');
		flake.className = 'snow';
		flake.dataset.x = String(Math.random() * 100);
		flake.dataset.y = String(Math.random() * 100);
		flake.dataset.size = String(2 + Math.random() * 8);
		flake.dataset.speed = String(18 + Math.random() * 42);
		flake.dataset.drift = String(12 + Math.random() * 34);
		flake.dataset.phase = String(Math.random() * Math.PI * 2);
		flake.dataset.delay = String(Math.random() * 3);
		snowLayer.appendChild(flake);
		snowFlakes.push(flake);
	}
}

function updateSnow(time = 0) {
	if (!snowLayer || snowFlakes.length === 0) return;

	const t = time * 0.001;
	snowFlakes.forEach((flake, index) => {
		const size = Number(flake.dataset.size || 4);
		const speed = Number(flake.dataset.speed || 25) * 0.58;
		const drift = Number(flake.dataset.drift || 16) * 0.7;
		const phase = Number(flake.dataset.phase || 0);
		const delay = Number(flake.dataset.delay || 0);
		const xBase = ((index * 17.37) % 100);
		const yBase = ((t * speed * 0.9 + index * 3.8 + delay) % 120) - 10;
		const xDrift = Math.sin(t * 0.55 + phase + index) * drift;
		const left = (xBase + xDrift + 100) % 100;
		const top = yBase;
		const glow = 0.35 + (Math.sin(t * 1.8 + phase) + 1) * 0.35;

		flake.style.left = `${left}%`;
		flake.style.top = `${top}%`;
		flake.style.width = `${size}px`;
		flake.style.height = `${size}px`;
		flake.style.opacity = String(Math.max(0.18, Math.min(1, glow)));
		flake.style.transform = `translate3d(0, 0, 0) scale(${0.9 + size * 0.08})`;
	});
}

function render() {
	const dollyProgress = Math.min(1, amount / 0.82);
	const easedDolly = dollyProgress * dollyProgress * (3 - 2 * dollyProgress);
	const sequenceProgress = amount * Math.max(0, imagePlanes.length - 1);
	const scale = 1 + easedDolly * 0.34;

	imagePlanes.forEach((plane, index) => {
		const opacity = Math.max(0, 1 - Math.abs(sequenceProgress - index));
		plane.style.opacity = String(opacity);
		plane.style.transform = `scale(${scale})`;
	});
}

function updateFromScroll() {
	if (autoplay) return;
	const scrollDistance = sequence ? sequence.offsetHeight - window.innerHeight : 0;
	targetAmount = scrollDistance > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollDistance)) : 0;
	if (!scrollEaseFrame) scrollEaseFrame = requestAnimationFrame(easeScroll);
}

function easeScroll() {
	const difference = targetAmount - amount;
	if (Math.abs(difference) < 0.001) {
		amount = targetAmount;
		scrollEaseFrame = 0;
		render();
		return;
	}
	amount += difference * 0.14;
	render();
	scrollEaseFrame = requestAnimationFrame(easeScroll);
}

function requestRender() {
	if (!renderFrame) {
		renderFrame = requestAnimationFrame(() => {
			renderFrame = 0;
			updateFromScroll();
		});
	}
}

function stopAutoplay() {
	autoplay = false;
	playbackStart = 0;
	if (playbackFrame) cancelAnimationFrame(playbackFrame);
	playbackFrame = 0;
}

function animate(time) {
	if (!autoplay) return;
	if (!playbackStart) playbackStart = time;
	amount = Math.min(1, (time - playbackStart) / duration);
	targetAmount = amount;
	const scrollDistance = sequence ? sequence.offsetHeight - window.innerHeight : 0;
	window.scrollTo(0, scrollDistance * amount);
	render();
	if (amount >= 1) {
		stopAutoplay();
		return;
	}
	playbackFrame = requestAnimationFrame(animate);
}

function startAutoplay(allowReducedMotion = false) {
	stopAutoplay();
	amount = 0;
	targetAmount = 0;
	window.scrollTo(0, 0);
	render();
	if (reducedMotion.matches && !allowReducedMotion) return;
	autoplay = true;
	playbackFrame = requestAnimationFrame(animate);
}

if (passwordToggle && passwordInput) {
	passwordToggle.addEventListener('click', () => {
		const showingPassword = passwordInput.type === 'password';
		passwordInput.type = showingPassword ? 'text' : 'password';
		passwordToggle.setAttribute('aria-label', showingPassword ? 'Hide password' : 'Show password');
		passwordToggle.title = showingPassword ? 'Hide password' : 'Show password';
	});
}

if (loginForm && loginFeedback) {
	loginForm.addEventListener('submit', (event) => {
		event.preventDefault();
		loginFeedback.textContent = 'Sign-in is not connected yet.';
		loginFeedback.hidden = false;
	});
}

addEventListener('scroll', requestRender, { passive: true });
addEventListener('resize', requestRender);
addEventListener('wheel', stopAutoplay, { passive: true });
addEventListener('touchstart', stopAutoplay, { passive: true });
addEventListener('keydown', (event) => {
	if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', 'Space'].includes(event.code)) {
		stopAutoplay();
	}
});

buildSnowField();
updateFromScroll();

function animateSnowBackground(time) {
	updateSnow(time);
	requestAnimationFrame(animateSnowBackground);
}

requestAnimationFrame(animateSnowBackground);
requestAnimationFrame(() => startAutoplay());