let estabelecimentos = [];
let map, userMarker, markersLayer;

const filtros = {
  texto: '',
  culinaria: [],
  preco: [],
  abertoAgora: false,
  cidade: 'todas'
};

// Carregar dados do JSON local
async function carregarEstabelecimentos() {
  try {
    const response = await fetch('estabelecimentos.json');
    estabelecimentos = await response.json();

    // Atualiza status "aberto agora" dinamicamente
    atualizarStatusAberto();

    renderizarLista();
    renderizarMapa();
    popularFiltrosCulinaria();
    ajustarZoomInicial();
  } catch (err) {
    console.error("Erro ao carregar estabelecimentos.json", err);
  }
}

function atualizarStatusAberto() {
  const agora = new Date();
  const diaSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][agora.getDay()];
  const horaAtual = agora.getHours() * 60 + agora.getMinutes();

  estabelecimentos.forEach(est => {
    let aberto = false;
    if (est.horario_funcionamento) {
      for (const [dias, horario] of Object.entries(est.horario_funcionamento)) {
        const diasArray = dias.split('-');
        const incluiHoje = diasArray.some(d => d === diaSemana || (diasArray[0] === 'seg' && diaSemana === 'dom')); // fallback domingo
        if (incluiHoje && horario) {
          const [abre, fecha] = horario.split('-');
          const [hAbre, mAbre] = abre.split(':').map(Number);
          const [hFecha, mFecha] = fecha.split(':').map(Number);
          const minutoAbre = hAbre * 60 + mAbre;
          const minutoFecha = hFecha * 60 + mFecha;
          aberto = horaAtual >= minutoAbre && horaAtual <= minutoFecha;
        }
      }
    }
    est.status_aberto = aberto;
  });
}

function ajustarZoomInicial() {
  if (estabelecimentos.length > 0) {
    const bounds = L.latLngBounds(estabelecimentos.map(e => [e.latitude, e.longitude]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMap();
  carregarEstabelecimentos();
  setupEventListeners();
});

// Tema
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  atualizarTemaMapa();
});

function atualizarTemaMapa() {
  const tileLayer = document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  map.eachLayer(layer => {
    if (layer.options && layer.options.attribution) map.removeLayer(layer);
  });
  L.tileLayer(tileLayer, { attribution: '&copy; OpenStreetMap & Carto' }).addTo(map);
  if (markersLayer) markersLayer.addTo(map);
}

// Mapa
function initMap() {
  map = L.map('map').setView([-10.9, -37.4], 9);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap & Carto'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);

  map.on('click', solicitarLocalizacao);
}

function solicitarLocalizacao() {
  if (navigator.geolocation && !userMarker) {
    navigator.geolocation.getCurrentPosition(pos => {
      const latLng = [pos.coords.latitude, pos.coords.longitude];
      userMarker = L.circleMarker(latLng, { color: '#007aff', radius: 8, fillOpacity: 0.8 })
        .addTo(map)
        .bindPopup("Você está aqui")
        .openPopup();
      map.setView(latLng, 14);
    });
  }
}

// Renderização
function renderizarLista() {
  const container = document.getElementById('listaEstabelecimentos');
  container.innerHTML = '';

  const filtrados = estabelecimentos.filter(aplicaFiltros);

  if (filtrados.length === 0) {
    container.innerHTML = '<p class="empty-state fade-in">Nenhum local encontrado com os filtros atuais.</p>';
    return;
  }

  filtrados.forEach(est => {
    const card = document.createElement('div');
    card.className = 'card fade-in';
    card.innerHTML = `
      <img src="${est.imagens[0]}" alt="${est.nome}" loading="lazy">
      <div class="card-content">
        <h3>${est.nome}</h3>
        <p>${capitalizar(est.cidade)} • ${est.tipo_culinaria}</p>
        <p>Preço ${est.faixa_preco} • ${est.status_aberto ? 'Aberto agora' : 'Fechado'}</p>
        <div class="tags">
          <span class="tag">${est.tipo_culinaria}</span>
          <span class="tag">${est.faixa_preco}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => abrirDetalhe(est));
    container.appendChild(card);
  });
}

function renderizarMapa() {
  markersLayer.clearLayers();
  estabelecimentos.filter(aplicaFiltros).forEach(est => {
    const marker = L.marker([est.latitude, est.longitude], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: est.status_aberto ? '🟢' : '🔴',
        iconSize: [20, 20]
      })
    })
    .bindPopup(`<b>${est.nome}</b><br>${est.tipo_culinaria} • ${est.faixa_preco}`)
    .addTo(markersLayer);
    marker.on('click', () => abrirDetalhe(est));
  });
}

function abrirDetalhe(est) {
  const modal = document.getElementById('modalDetalhe');
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <h2>${est.nome}</h2>
    <img src="${est.imagens[0]}" alt="${est.nome}">
    <p>${est.descricao}</p>
    <p><strong>Cidade:</strong> ${capitalizar(est.cidade)}</p>
    <p><strong>Culinária:</strong> ${est.tipo_culinaria}</p>
    <p><strong>Preço:</strong> ${est.faixa_preco}</p>
    <p><strong>Status:</strong> ${est.status_aberto ? 'Aberto agora' : 'Fechado'}</p>
    <a href="https://wa.me/55${est.whatsapp_numero.replace(/\D/g,'')}" target="_blank" class="whatsapp-btn">
      Abrir WhatsApp
    </a>
  `;
  modal.classList.add('active');
}

function capitalizar(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Filtros
function aplicaFiltros(est) {
  if (filtros.texto && !est.nome.toLowerCase().includes(filtros.texto.toLowerCase())) return false;
  if (filtros.cidade !== 'todas' && est.cidade !== filtros.cidade) return false;
  if (filtros.culinaria.length && !filtros.culinaria.includes(est.tipo_culinaria)) return false;
  if (filtros.preco.length && !filtros.preco.includes(est.faixa_preco)) return false;
  if (filtros.abertoAgora && !est.status_aberto) return false;
  return true;
}

function popularFiltrosCulinaria() {
  const tipos = [...new Set(estabelecimentos.map(e => e.tipo_culinaria))].sort();
  const container = document.getElementById('culinariaFilter');
  container.innerHTML = '';
  tipos.forEach(t => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = capitalizar(t);
    chip.dataset.culinaria = t;
    container.appendChild(chip);
  });
}

// Eventos
function setupEventListeners() {
  // Busca
  document.getElementById('searchInput').addEventListener('input', e => {
    filtros.texto = e.target.value;
    renderizarLista();
    renderizarMapa();
  });

  // Filtros preço
  document.querySelectorAll('[data-preco]').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      filtros.preco = Array.from(document.querySelectorAll('[data-preco].active'))
        .map(c => c.dataset.preco);
      renderizarLista(); renderizarMapa();
    });
  });

  // Filtros culinária
  document.addEventListener('click', e => {
    if (e.target.matches('[data-culinaria]')) {
      e.target.classList.toggle('active');
      filtros.culinaria = Array.from(document.querySelectorAll('[data-culinaria].active'))
        .map(c => c.dataset.culinaria);
      renderizarLista(); renderizarMapa();
    }
  });

  // Aberto agora
  document.getElementById('abertoAgora').addEventListener('change', e => {
    filtros.abertoAgora = e.target.checked;
    renderizarLista(); renderizarMapa();
  });

  // Limpar filtros
  document.getElementById('clearFilters').addEventListener('click', () => {
    document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
    document.getElementById('abertoAgora').checked = false;
    document.getElementById('searchInput').value = '';
    filtros = { texto: '', culinaria: [], preco: [], abertoAgora: false, cidade: 'todas' };
    renderizarLista(); renderizarMapa();
  });

  // Fechar modal
  document.querySelector('.modal-close, .modal').addEventListener('click', e => {
    if (e.target.matches('.modal') || e.target.matches('.modal-close')) {
      document.getElementById('modalDetalhe').classList.remove('active');
    }
  });

  // Fullscreen mapa
  document.getElementById('fullscreenMap').addEventListener('click', () => {
    document.querySelector('.map-container').classList.toggle('fullscreen');
    setTimeout(() => map.invalidateSize(), 300);
  });
}