(() => {
	const board = document.querySelector('#chess-board');
	if (!board) return;

	const status = document.querySelector('#chess-status');
	const createButton = document.querySelector('#chess-create');
	const joinButton = document.querySelector('#chess-join');
	const copyButton = document.querySelector('#chess-copy');
	const roomInput = document.querySelector('#chess-room-input');
	const chessRoom = document.querySelector('#chess-room');
	const chessLaunch = document.querySelector('#chess-launch');
	const files = 'abcdefgh';
	const glyphs = {
		wk: '\u2654', wq: '\u2655', wr: '\u2656', wb: '\u2657', wn: '\u2658', wp: '\u2659',
		bk: '\u265a', bq: '\u265b', br: '\u265c', bb: '\u265d', bn: '\u265e', bp: '\u265f'
	};
	let game = null;
	let peer = null;
	let connection = null;
	let role = null;
	let selected = null;
	let targets = [];
	let lastMove = null;
	let inviteValue = '';

	function showStatus(message) {
		status.textContent = message;
	}

	function currentStatus() {
		if (!role) return 'Create a room or join a friend\'s invite.';
		if (game.game_over()) {
			if (game.in_checkmate()) return `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate.`;
			return 'The game is a draw.';
		}
		if (game.in_check()) return game.turn() === (role === 'white' ? 'w' : 'b') ? 'Your king is in check. Your move.' : 'Your opponent is in check.';
		return game.turn() === (role === 'white' ? 'w' : 'b') ? 'Your move.' : 'Waiting for your opponent.';
	}

	function renderBoard() {
		board.replaceChildren();
		for (let rank = 8; rank >= 1; rank -= 1) {
			for (let file = 0; file < 8; file += 1) {
				const square = `${files[file]}${rank}`;
				const piece = game ? game.get(square) : null;
				const button = document.createElement('button');
				button.type = 'button';
				button.className = `chess-square ${(rank + file) % 2 === 0 ? 'light' : 'dark'}`;
				button.dataset.square = square;
				button.setAttribute('role', 'gridcell');
				button.setAttribute('aria-label', `${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`);
				if (piece) {
					button.textContent = glyphs[`${piece.color}${piece.type}`];
					button.classList.add(piece.color === 'w' ? 'white-piece' : 'black-piece');
				}
				if (square === selected) button.classList.add('selected');
				if (targets.includes(square)) button.classList.add('legal-target');
				if (lastMove && (square === lastMove.from || square === lastMove.to)) button.classList.add('last-move');
				board.append(button);
			}
		}
		if (game) showStatus(currentStatus());
	}

	function closePeer() {
		if (connection) connection.close();
		if (peer) peer.destroy();
		connection = null;
		peer = null;
	}

	function bindConnection(conn, playerRole) {
		connection = conn;
		role = playerRole;
		connection.on('open', () => {
			if (role === 'white') {
				connection.send({ type: 'sync', fen: game.fen() });
				showStatus('Friend connected. You are White.');
			} else {
				showStatus('Connected. You are Black.');
			}
		});
		connection.on('data', (message) => {
			if (message?.type === 'sync' && role === 'black') {
				game.load(message.fen);
				lastMove = null;
				selected = null;
				targets = [];
				renderBoard();
				return;
			}
			if (message?.type === 'move' && game) {
				try {
					const move = game.move(message.move);
					if (move) lastMove = { from: move.from, to: move.to };
					selected = null;
					targets = [];
					renderBoard();
				} catch {
					showStatus('Could not sync that move. Rejoin the invite.');
				}
			}
		});
		connection.on('close', () => showStatus('Friend disconnected. The room is still open.'));
		connection.on('error', () => showStatus('Connection lost. Try joining the invite again.'));
	}

	function createRoom() {
		closePeer();
		game = new Chess();
		role = 'white';
		lastMove = null;
		renderBoard();
		copyButton.hidden = true;
		showStatus('Connecting to the invite service...');
		peer = new Peer();
		peer.on('open', (id) => {
			const url = new URL(window.location.href);
			url.searchParams.set('chess', id);
			inviteValue = location.protocol === 'file:' ? id : url.toString();
			roomInput.value = inviteValue;
			copyButton.hidden = false;
			showStatus(location.protocol === 'file:' ? 'Room code ready. Host this page online, then share the room code.' : 'Room ready. You are White; send the invite to a friend.');
		});
		peer.on('connection', (conn) => {
			if (connection?.open) {
				conn.close();
				return;
			}
			bindConnection(conn, 'white');
		});
		peer.on('error', () => showStatus('Could not create a room. Check your internet connection and try again.'));
	}

	function joinRoom(value) {
		let roomId = value.trim();
		try {
			roomId = new URL(roomId).searchParams.get('chess') || roomId;
		} catch {
			// Accept either a full invite URL or a room code.
		}
		if (!roomId) {
			showStatus('Paste a friend\'s invite link or room code first.');
			return;
		}
		closePeer();
		game = new Chess();
		role = 'black';
		lastMove = null;
		renderBoard();
		showStatus('Connecting to your friend...');
		peer = new Peer();
		peer.on('open', () => bindConnection(peer.connect(roomId), 'black'));
		peer.on('error', () => showStatus('Could not join that room. Check the invite and try again.'));
	}

	board.addEventListener('click', (event) => {
		const squareButton = event.target.closest('[data-square]');
		if (!squareButton || !game) return;
		if (!role || !connection?.open) {
			showStatus('Create a room or connect to a friend before playing.');
			return;
		}
		const square = squareButton.dataset.square;
		const ownColor = role === 'white' ? 'w' : 'b';
		if (game.turn() !== ownColor) {
			showStatus('Wait for your opponent to move.');
			return;
		}
		if (selected && targets.includes(square)) {
			try {
				const move = game.move({ from: selected, to: square, promotion: 'q' });
				lastMove = { from: move.from, to: move.to };
				connection.send({ type: 'move', move: { from: move.from, to: move.to, promotion: move.promotion } });
				selected = null;
				targets = [];
				renderBoard();
				return;
			} catch {
				selected = null;
				targets = [];
			}
		}
		const piece = game.get(square);
		if (piece?.color === ownColor) {
			selected = square;
			targets = game.moves({ square, verbose: true }).map((move) => move.to);
		} else {
			selected = null;
			targets = [];
		}
		renderBoard();
	});

	createButton.addEventListener('click', createRoom);
	joinButton.addEventListener('click', () => joinRoom(roomInput.value));
	copyButton.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(inviteValue);
			showStatus('Invite copied. Send it to your friend.');
		} catch {
			roomInput.focus();
			roomInput.select();
			showStatus('Select and copy the invite to send it to your friend.');
		}
	});

	const roomFromInvite = new URLSearchParams(window.location.search).get('chess');
	chessLaunch.addEventListener('click', () => {
		const opening = chessRoom.hidden;
		chessRoom.hidden = !opening;
		chessLaunch.setAttribute('aria-expanded', String(opening));
		if (opening) {
			chessRoom.scrollIntoView({ behavior: 'smooth', block: 'start' });
			if (roomFromInvite && !role) joinRoom(roomFromInvite);
		}
	});

	const gameToggles = document.querySelectorAll('.game-toggle');
	const gamePanels = document.querySelectorAll('.game-panel');
	gameToggles.forEach((toggle) => {
		toggle.addEventListener('click', () => {
			const panelId = toggle.dataset.panel;
			const targetPanel = document.getElementById(panelId);
			if (!targetPanel) return;

			const isOpen = toggle.getAttribute('aria-expanded') === 'true';
			gamePanels.forEach((panel) => { panel.hidden = true; });
			gameToggles.forEach((item) => item.setAttribute('aria-expanded', 'false'));

			if (!isOpen) {
				targetPanel.hidden = false;
				toggle.setAttribute('aria-expanded', 'true');
			}
		});
	});

	if (roomFromInvite) {
		roomInput.value = roomFromInvite;
	} else {
		game = new Chess();
		renderBoard();
	}
})();