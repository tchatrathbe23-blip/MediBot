(function() {
  const styles = `
    .medi-chat-bubble {
      position: fixed;
      bottom: 25px;
      right: 25px;
      width: 65px;
      height: 65px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      box-shadow: 0 10px 25px -3px rgba(6, 182, 212, 0.4), 0 0 20px rgba(6, 182, 212, 0.3);
      z-index: 9999;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      background: radial-gradient(circle at 30% 30%, #06b6d4, #0f172a);
      border: 2px solid rgba(6, 182, 212, 0.6);
      overflow: hidden;
    }
    .medi-chat-bubble:hover {
      transform: scale(1.1) rotate(5deg);
      box-shadow: 0 15px 35px rgba(6, 182, 212, 0.6);
    }

    #bubbleCanvas {
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: none;
    }

    .medi-chat-window {
      position: fixed;
      bottom: 100px;
      right: 25px;
      width: 420px;
      max-width: calc(100vw - 40px);
      height: 560px;
      max-height: calc(100vh - 140px);
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(6, 182, 212, 0.4);
      border-radius: 1.5rem;
      display: none;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6), 0 0 35px rgba(6, 182, 212, 0.2);
      z-index: 9999;
      overflow: hidden;
      font-family: 'Inter', sans-serif;
      transform: scale(0.9) translateY(20px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .medi-chat-window.open {
      display: flex;
      transform: scale(1) translateY(0);
      opacity: 1;
    }

    .medi-chat-header {
      padding: 1.15rem 1.25rem;
      background: rgba(17, 24, 39, 0.6);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .medi-chat-messages {
      flex: 1;
      padding: 1.25rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      background: rgba(11, 15, 25, 0.5);
    }

    .msg {
      padding: 0.85rem 1.15rem;
      border-radius: 1.15rem;
      max-width: 88%;
      font-size: 0.9rem;
      line-height: 1.6;
      word-wrap: break-word;
      animation: fadeIn 0.3s ease-out;
    }

    .msg-bot {
      background: rgba(30, 41, 59, 0.85);
      color: #f8fafc;
      align-self: flex-start;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-bottom-left-radius: 0.3rem;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }

    .msg-bot strong { color: #38bdf8; }
    .msg-bot p { margin-bottom: 0.5rem; }
    .msg-bot p:last-child { margin-bottom: 0; }
    .msg-bot ul, .msg-bot ol { margin-left: 1.25rem; margin-bottom: 0.5rem; }

    .msg-user {
      background: linear-gradient(135deg, #06b6d4, #0284c7);
      color: #ffffff;
      align-self: flex-end;
      border-bottom-right-radius: 0.3rem;
      box-shadow: 0 4px 15px rgba(6, 182, 212, 0.3);
      font-weight: 500;
    }

    .medi-suggestions {
      padding: 0.5rem 1rem;
      display: flex;
      gap: 0.4rem;
      overflow-x: auto;
      background: rgba(17, 24, 39, 0.4);
      border-top: 1px solid rgba(255, 255, 255, 0.04);
    }
    .medi-suggestions::-webkit-scrollbar { height: 3px; }

    .suggestion-chip {
      background: rgba(6, 182, 212, 0.1);
      border: 1px solid rgba(6, 182, 212, 0.3);
      color: #38bdf8;
      padding: 0.35rem 0.75rem;
      border-radius: 2rem;
      font-size: 0.75rem;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.2s;
    }
    .suggestion-chip:hover {
      background: #06b6d4;
      color: #0b0f19;
      font-weight: 600;
    }

    .medi-chat-input {
      padding: 0.85rem 1rem;
      background: rgba(17, 24, 39, 0.7);
      display: flex;
      gap: 0.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      align-items: center;
    }

    .medi-chat-input input {
      flex: 1;
      background: rgba(11, 15, 25, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #f8fafc;
      padding: 0.75rem 1rem;
      border-radius: 0.85rem;
      outline: none;
      font-size: 0.9rem;
      transition: border-color 0.2s;
    }
    .medi-chat-input input:focus {
      border-color: #06b6d4;
      box-shadow: 0 0 10px rgba(6, 182, 212, 0.25);
    }

    .medi-chat-input button {
      background: linear-gradient(135deg, #06b6d4, #0284c7);
      border: none;
      color: white;
      width: 42px;
      height: 42px;
      border-radius: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      transition: all 0.2s;
      box-shadow: 0 2px 10px rgba(6, 182, 212, 0.3);
    }
    .medi-chat-input button:hover {
      transform: scale(1.05);
      background: linear-gradient(135deg, #0891b2, #0369a1);
    }

    .typing-indicator {
      font-size: 0.8rem;
      color: #38bdf8;
      margin-bottom: 0.5rem;
      display: none;
      align-items: center;
      gap: 0.4rem;
      padding-left: 0.5rem;
    }
  `;

  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  const container = document.createElement("div");
  container.innerHTML = `
    <div id="mediBubble" class="medi-chat-bubble" title="Open MediBot AI Assistant">
      <canvas id="bubbleCanvas"></canvas>
    </div>
    <div id="mediWindow" class="medi-chat-window">
      <div class="medi-chat-header">
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div style="width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981;"></div>
          <div>
            <span style="font-weight:700; font-size:0.95rem; color:#f8fafc; display:block; line-height:1.2;">MediBot Companion</span>
            <span style="font-size:0.7rem; color:#94a3b8;">Groq LPU Intelligence</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <i class="ph ph-trash" style="cursor:pointer; font-size:1.1rem; color:#94a3b8;" id="clearMediChat" title="Clear Chat"></i>
          <i class="ph ph-x" style="cursor:pointer; font-size:1.2rem; color:#94a3b8;" id="closeMediChat" title="Close"></i>
        </div>
      </div>

      <div class="medi-suggestions">
        <div class="suggestion-chip" data-query="Can you summarize my latest report?">📋 Summarize Report</div>
        <div class="suggestion-chip" data-query="What diet changes should I make based on my tests?">🥗 Meal Advice</div>
        <div class="suggestion-chip" data-query="What safe exercises are recommended for me?">🏃 Safe Workouts</div>
        <div class="suggestion-chip" data-query="When should I schedule a follow-up doctor visit?">🩺 Doctor Visit</div>
      </div>

      <div class="medi-chat-messages" id="mediMsgs">
        <div class="msg msg-bot">
          Hello! I am your <strong>MediBot Clinical Companion</strong>. I have real-time access to your uploaded health records. Ask me anything about your biomarkers, diagnoses, or daily wellness plans!
        </div>
        <div id="typingIndicator" class="typing-indicator">
          <i class="ph ph-circle-notch ph-spin"></i> Assistant is analyzing clinical data...
        </div>
      </div>

      <div class="medi-chat-input">
        <input type="text" id="mediInput" placeholder="Ask about lab metrics, diet, or symptoms...">
        <button id="mediSend" type="button" title="Send message"><i class="ph ph-paper-plane-right"></i></button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  const bubble = document.getElementById("mediBubble");
  const bubbleCanvas = document.getElementById("bubbleCanvas");
  const chatWindow = document.getElementById("mediWindow");
  const closeBtn = document.getElementById("closeMediChat");
  const clearBtn = document.getElementById("clearMediChat");
  const sendBtn = document.getElementById("mediSend");
  const input = document.getElementById("mediInput");
  const msgs = document.getElementById("mediMsgs");
  // Always re-query typing indicator live to avoid stale reference after innerHTML resets
  function getTyping() { return msgs.querySelector("#typingIndicator"); }
  // Safe insert: places node before the typing indicator, or appends if indicator was removed
  function insertMsg(node) {
    const t = getTyping();
    if (t && t.parentNode === msgs) {
      msgs.insertBefore(node, t);
    } else {
      msgs.appendChild(node);
    }
  }

  // --- 3D Mini Orb in Bubble Canvas ---
  let isThinking = false;
  if (window.THREE && bubbleCanvas) {
    try {
      const bScene = new THREE.Scene();
      const bCam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      bCam.position.z = 8;

      const bRenderer = new THREE.WebGLRenderer({ canvas: bubbleCanvas, alpha: true, antialias: true });
      bRenderer.setSize(65, 65);
      bRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // 3D Core Sphere
      const bGeo = new THREE.IcosahedronGeometry(2.0, 2);
      const bMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bScene.add(bMesh);

      // Orbiting Ring
      const rGeo = new THREE.TorusGeometry(3.0, 0.08, 8, 32);
      const rMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.rotation.x = Math.PI / 3;
      bScene.add(rMesh);

      const bClock = new THREE.Clock();

      function animBubble() {
        requestAnimationFrame(animBubble);
        const el = bClock.getElapsedTime();
        const speed = isThinking ? 4.0 : 1.0;
        bMesh.rotation.y = el * 0.8 * speed;
        bMesh.rotation.x = el * 0.4 * speed;
        rMesh.rotation.z = el * 1.2 * speed;
        bRenderer.render(bScene, bCam);
      }
      animBubble();
    } catch (e) {}
  }

  // --- Interaction Listeners ---
  bubble.addEventListener("click", () => {
    const isOpen = chatWindow.classList.contains("open");
    if (isOpen) {
      chatWindow.classList.remove("open");
    } else {
      chatWindow.classList.add("open");
      input.focus();
    }
  });

  closeBtn.addEventListener("click", () => chatWindow.classList.remove("open"));

  clearBtn.addEventListener("click", () => {
    msgs.innerHTML = `
      <div class="msg msg-bot">
        Conversation history cleared. How can I assist you with your health records today?
      </div>
      <div id="typingIndicator" class="typing-indicator">
        <i class="ph ph-circle-notch ph-spin"></i> Assistant is analyzing clinical data...
      </div>
    `;
  });

  // Suggestion Chips Click
  document.querySelectorAll(".suggestion-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const q = chip.getAttribute("data-query");
      input.value = q;
      sendMessage();
    });
  });

  function parseContent(raw) {
    if (window.marked) {
      try {
        return marked.parse(raw);
      } catch (e) {}
    }
    return raw.replace(/\n/g, '<br>');
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    const userDiv = document.createElement("div");
    userDiv.className = "msg msg-user";
    userDiv.innerText = text;
    insertMsg(userDiv);
    input.value = "";

    const typingEl = getTyping();
    if (typingEl) typingEl.style.display = "flex";
    isThinking = true;
    msgs.scrollTop = msgs.scrollHeight;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": token },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      const typingEl2 = getTyping();
      if (typingEl2) typingEl2.style.display = "none";
      isThinking = false;
      
      const botDiv = document.createElement("div");
      botDiv.className = "msg msg-bot";
      botDiv.innerHTML = data.reply ? parseContent(data.reply) : "I'm currently synthesizing your clinical records. Please hold on.";
      insertMsg(botDiv);
      msgs.scrollTop = msgs.scrollHeight;
    } catch (err) {
      const typingEl3 = getTyping();
      if (typingEl3) typingEl3.style.display = "none";
      isThinking = false;
      const botDiv = document.createElement("div");
      botDiv.className = "msg msg-bot";
      botDiv.innerText = "Network connection lost. Please verify your internet and try again.";
      insertMsg(botDiv);
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

})();

