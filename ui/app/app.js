(function () {
  const ASSETS = {
    banner: "assets/banner.png",
    chevron: "assets/chevron.svg",
    chevronBlue: "assets/chevron-blue.svg",
    chevronLeft: "assets/chevron-left.svg",
    check: "assets/check.svg",
  };

  let menuEl = null;
  let headerMetaLeft = null;
  let headerMetaRight = null;
  let bodyEl = null;
  let footerEl = null;
  let footerText = null;
  let bannerImg = null;
  let hideTimeout = null;
  let enterTimeout = null;

  let currentMenu = null;
  let selectedIndex = 0;
  let isOpen = false;
  let depth = 1;

  function nui(name, data) {
    return fetch(`https://${GetParentResourceName()}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {}),
    });
  }

  function el(tag, className, attrs) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "text") node.textContent = attrs[key];
        else if (key === "html") node.innerHTML = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    return node;
  }

  function img(src, className) {
    return el("img", className, { src: src, alt: "" });
  }

  function optionCount() {
    return currentMenu && currentMenu.options ? currentMenu.options.length : 0;
  }

  function isNavigable(opt) {
    return !!opt && opt.type !== "separator" && !opt.disabled;
  }

  function navigableList() {
    const opts = (currentMenu && currentMenu.options) || [];
    const list = [];
    opts.forEach(function (opt, i) {
      if (isNavigable(opt)) list.push(i);
    });
    return list;
  }

  function firstNavigable() {
    const list = navigableList();
    return list.length ? list[0] : 0;
  }

  function clampSelected() {
    const count = optionCount();
    if (count <= 0) {
      selectedIndex = 0;
      return;
    }
    if (selectedIndex < 0) selectedIndex = count - 1;
    if (selectedIndex >= count) selectedIndex = 0;
    if (!isNavigable(currentMenu.options[selectedIndex])) {
      selectedIndex = firstNavigable();
    }
  }

  function fitFooterText(text) {
    if (!footerText) return;
    const value = text || "";
    const len = value.trim().length;
    let size = 12;
    if (len > 40) size = 11;
    if (len > 80) size = 10;
    if (len > 140) size = 9;
    if (len > 220) size = 8;
    footerText.style.fontSize = "calc(" + size + " * var(--u))";
    footerText.textContent = value;
    if (footerEl) footerEl.style.display = len ? "flex" : "none";
  }

  function updateMeta() {
    if (!currentMenu) return;
    if (headerMetaLeft) {
      headerMetaLeft.textContent = currentMenu.title || "Description";
    }
    if (headerMetaRight) {
      const list = navigableList();
      const pos = list.indexOf(selectedIndex);
      headerMetaRight.textContent =
        list.length > 0 && pos >= 0 ? pos + 1 + "/" + list.length : "0/0";
    }
    const opt = currentMenu.options && currentMenu.options[selectedIndex];
    fitFooterText(
      (opt && opt.description) || currentMenu.description || ""
    );
  }

  function setSelected(index, scroll) {
    selectedIndex = index;
    clampSelected();

    const items = bodyEl ? bodyEl.querySelectorAll("[data-opt-index]") : [];
    items.forEach(function (node) {
      const i = Number(node.getAttribute("data-opt-index"));
      node.classList.toggle("is-selected", i === selectedIndex);
    });

    updateMeta();

    if (scroll) {
      const row = bodyEl.querySelector(
        '[data-opt-index="' + selectedIndex + '"]'
      );
      if (row) row.scrollIntoView({ block: "nearest" });
    }
  }

  function buildChevronAction(outline) {
    const wrap = el(
      "div",
      "menu-row__action " +
        (outline ? "menu-row__action--outline" : "menu-row__action--chevron")
    );
    wrap.appendChild(img(outline ? ASSETS.chevronBlue : ASSETS.chevron));
    return wrap;
  }

  function buildCheckAction(checked) {
    const wrap = el("div", "menu-row__action menu-row__action--check");
    if (checked) wrap.classList.add("is-checked");
    const icon = img(ASSETS.check);
    icon.style.display = checked ? "block" : "none";
    icon.dataset.role = "check-icon";
    wrap.appendChild(icon);
    return wrap;
  }

  function buildSliderControl(opt, index) {
    const values = opt.values || [];
    let valueIndex = (opt.value || 1) - 1;
    if (valueIndex < 0) valueIndex = 0;
    if (valueIndex >= values.length) valueIndex = Math.max(0, values.length - 1);

    const wrap = el("div", "menu-slider glass-soft");
    const left = el("button", "menu-slider__btn menu-slider__btn--left", {
      type: "button",
    });
    left.appendChild(img(ASSETS.chevronLeft));

    const value = el("span", "menu-slider__value", {
      text: values[valueIndex] != null ? String(values[valueIndex]) : "",
    });
    value.dataset.role = "slider-value";

    const right = el("button", "menu-slider__btn", { type: "button" });
    right.appendChild(img(ASSETS.chevron));

    function apply(next) {
      if (!values.length) return;
      if (next < 0) next = values.length - 1;
      if (next >= values.length) next = 0;
      valueIndex = next;
      value.textContent = String(values[valueIndex]);
      opt.value = valueIndex + 1;
      nui("changeSlider", { index: index + 1, value: opt.value });
    }

    left.addEventListener("click", function (e) {
      e.stopPropagation();
      apply(valueIndex - 1);
    });

    right.addEventListener("click", function (e) {
      e.stopPropagation();
      apply(valueIndex + 1);
    });

    wrap.appendChild(left);
    wrap.appendChild(value);
    wrap.appendChild(right);
    wrap._setValue = function (luaValue) {
      valueIndex = (luaValue || 1) - 1;
      if (valueIndex < 0) valueIndex = 0;
      if (valueIndex >= values.length) valueIndex = Math.max(0, values.length - 1);
      value.textContent =
        values[valueIndex] != null ? String(values[valueIndex]) : "";
    };

    return wrap;
  }

  function buildRow(opt, index) {
    const typ = opt.type || "button";

    if (typ === "separator") {
      const sep = el("div", "menu-separator", {
        text: opt.label || "",
      });
      sep.setAttribute("data-opt-index", String(index));
      return sep;
    }

    const row = el("div", "menu-row glass-row");
    row.setAttribute("data-opt-index", String(index));
    if (opt.disabled) row.classList.add("is-disabled");

    row.appendChild(el("div", "menu-row__label", { text: opt.label || "" }));

    if (typ === "checkbox") {
      row.appendChild(buildCheckAction(!!opt.checked));
    } else if (typ === "slider") {
      row.appendChild(buildSliderControl(opt, index));
    } else if (typ === "submenu") {
      row.appendChild(buildChevronAction(false));
    }

    row.addEventListener("mouseenter", function () {
      if (!isOpen || opt.disabled) return;
      setSelected(index, false);
    });

    row.addEventListener("click", function () {
      if (!isOpen || opt.disabled) return;
      setSelected(index, false);
      activateSelected();
    });

    return row;
  }

  function renderMenu(data) {
    currentMenu = data;
    selectedIndex = firstNavigable();

    if (bannerImg && data.banner) {
      bannerImg.src = data.banner;
    }

    bodyEl.innerHTML = "";
    (data.options || []).forEach(function (opt, i) {
      bodyEl.appendChild(buildRow(opt, i));
    });

    setSelected(selectedIndex, false);
  }

  function showMenu(data, menuDepth) {
    if (!menuEl) return;

    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    if (enterTimeout) {
      clearTimeout(enterTimeout);
      enterTimeout = null;
    }

    depth = menuDepth || 1;
    isOpen = true;
    menuEl.style.display = "flex";
    menuEl.classList.remove("is-open", "is-entering");
    renderMenu(data);

    requestAnimationFrame(function () {
      menuEl.classList.add("is-open", "is-entering");
      enterTimeout = setTimeout(function () {
        menuEl.classList.remove("is-entering");
        enterTimeout = null;
      }, 600);
    });
  }

  function hideMenu() {
    if (!menuEl) return;
    isOpen = false;
    if (enterTimeout) {
      clearTimeout(enterTimeout);
      enterTimeout = null;
    }
    menuEl.classList.remove("is-open", "is-entering");
    hideTimeout = setTimeout(function () {
      menuEl.style.display = "none";
      hideTimeout = null;
    }, 300);
  }

  function moveSelection(delta) {
    const list = navigableList();
    if (!list.length) return;
    let pos = list.indexOf(selectedIndex);
    if (pos < 0) pos = 0;
    pos = (pos + delta + list.length) % list.length;
    setSelected(list[pos], true);
  }

  function changeSlider(delta) {
    const opt = currentMenu && currentMenu.options[selectedIndex];
    if (!opt || opt.type !== "slider" || !opt.values || !opt.values.length) return;

    let value = (opt.value || 1) + delta;
    if (value < 1) value = opt.values.length;
    if (value > opt.values.length) value = 1;
    opt.value = value;

    const row = bodyEl.querySelector(
      '[data-opt-index="' + selectedIndex + '"]'
    );
    const slider = row && row.querySelector(".menu-slider");
    if (slider && slider._setValue) slider._setValue(value);

    nui("changeSlider", { index: selectedIndex + 1, value: value });
  }

  function activateSelected() {
    const opt = currentMenu && currentMenu.options[selectedIndex];
    if (!opt || opt.disabled || opt.type === "separator") return;

    nui("selectOption", { index: selectedIndex + 1 });
  }

  function goBack() {
    nui("backMenu");
  }

  window.addEventListener("message", function (event) {
    const data = event.data;
    if (!data || !data.action) return;

    switch (data.action) {
      case "showMenu":
        showMenu(data.menu, data.depth);
        break;
      case "setMenu":
        depth = data.depth || depth;
        if (!isOpen) showMenu(data.menu, data.depth);
        else renderMenu(data.menu);
        break;
      case "hideMenu":
        hideMenu();
        break;
      case "updateOption": {
        if (!currentMenu || !currentMenu.options) break;
        const idx = (data.index || 1) - 1;
        const opt = currentMenu.options[idx];
        if (!opt) break;
        if (typeof data.checked === "boolean") {
          opt.checked = data.checked;
          const row = bodyEl.querySelector('[data-opt-index="' + idx + '"]');
          const action = row && row.querySelector(".menu-row__action--check");
          const icon = action && action.querySelector('[data-role="check-icon"]');
          if (action) action.classList.toggle("is-checked", opt.checked);
          if (icon) icon.style.display = opt.checked ? "block" : "none";
        }
        if (typeof data.value === "number") {
          opt.value = data.value;
          const row = bodyEl.querySelector('[data-opt-index="' + idx + '"]');
          const slider = row && row.querySelector(".menu-slider");
          if (slider && slider._setValue) slider._setValue(data.value);
        }
        updateMeta();
        break;
      }
      case "goBack":
        goBack();
        break;
      case "showHud":
        showHud();
        if (data.thirst != null || data.food != null) {
          setHud(data.thirst, data.food);
        }
        break;
      case "hideHud":
        hideHud();
        break;
      case "setHud":
        setHud(data.thirst, data.food);
        break;
      case "setHudThirst":
        setHud(data.value != null ? data.value : data.thirst, undefined);
        break;
      case "setHudFood":
        setHud(undefined, data.value != null ? data.value : data.food);
        break;
      case "key":
        switch (data.key) {
          case "up":
            moveSelection(-1);
            break;
          case "down":
            moveSelection(1);
            break;
          case "left":
            changeSlider(-1);
            break;
          case "right":
            changeSlider(1);
            break;
          case "enter":
            activateSelected();
            break;
          case "back":
            goBack();
            break;
          case "escape":
            if (depth > 1) goBack();
            else nui("closeMenu");
            break;
        }
        break;
    }
  });

  document.addEventListener("keydown", function (e) {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveSelection(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveSelection(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        changeSlider(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        changeSlider(1);
        break;
      case "Enter":
        e.preventDefault();
        activateSelected();
        break;
      case "Backspace":
        e.preventDefault();
        goBack();
        break;
      case "Escape":
        e.preventDefault();
        if (depth > 1) goBack();
        else nui("closeMenu");
        break;
    }
  });

  /* —— HUD —— */
  let hudEl = null;
  let thirstFill = null;
  let foodFill = null;
  const HUD_R = 20.5;

  function clampPct(v) {
    v = Number(v);
    if (isNaN(v)) return 0;
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
  }

  function setRingFill(circle, percent) {
    if (!circle) return;
    const pct = clampPct(percent);
    circle.style.strokeDashoffset = String(100 - pct);
    circle.setAttribute("data-pct", String(pct));
  }

  function setHud(thirst, food) {
    if (typeof thirst === "number") setRingFill(thirstFill, thirst);
    if (typeof food === "number") setRingFill(foodFill, food);
  }

  function showHud() {
    if (!hudEl) return;
    hudEl.classList.add("is-visible");
  }

  function hideHud() {
    if (!hudEl) return;
    hudEl.classList.remove("is-visible");
  }

  function buildMeter(kind) {
    const wrap = el("div", "hud-meter");
    wrap.setAttribute("data-kind", kind);

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "hud-meter__svg");
    svg.setAttribute("viewBox", "0 0 52 54");
    svg.setAttribute("fill", "none");

    const defs = document.createElementNS(ns, "defs");
    defs.innerHTML =
      '<linearGradient id="hud-g-outer-' +
      kind +
      '" x1="26" y1="0" x2="26" y2="54" gradientUnits="userSpaceOnUse">' +
      '<stop stop-color="#2A2A2A" stop-opacity="0.5"/>' +
      '<stop offset="0.5" stop-color="#1D1D1D" stop-opacity="0.5"/>' +
      '<stop offset="1" stop-color="#111111" stop-opacity="0.5"/>' +
      "</linearGradient>" +
      '<linearGradient id="hud-g-inner-' +
      kind +
      '" x1="26" y1="7" x2="26" y2="47" gradientUnits="userSpaceOnUse">' +
      '<stop stop-color="#2A2A2A" stop-opacity="0.5"/>' +
      '<stop offset="0.5" stop-color="#1D1D1D" stop-opacity="0.5"/>' +
      '<stop offset="1" stop-color="#111111" stop-opacity="0.5"/>' +
      "</linearGradient>" +
      '<linearGradient id="hud-ring-fill-' +
      kind +
      '" x1="0" y1="0" x2="52" y2="54" gradientUnits="userSpaceOnUse">' +
      '<stop stop-color="#ADBCD8"/>' +
      '<stop offset="1" stop-color="#5F93F1"/>' +
      "</linearGradient>";
    svg.appendChild(defs);

    const outer = document.createElementNS(ns, "rect");
    outer.setAttribute("width", "52");
    outer.setAttribute("height", "54");
    outer.setAttribute("rx", "26");
    outer.setAttribute("fill", "url(#hud-g-outer-" + kind + ")");
    outer.setAttribute("fill-opacity", "0.8");
    svg.appendChild(outer);

    const inner = document.createElementNS(ns, "rect");
    inner.setAttribute("x", "7");
    inner.setAttribute("y", "7");
    inner.setAttribute("width", "38");
    inner.setAttribute("height", "40");
    inner.setAttribute("rx", "19");
    inner.setAttribute("fill", "url(#hud-g-inner-" + kind + ")");
    inner.setAttribute("fill-opacity", "0.8");
    svg.appendChild(inner);

    const track = document.createElementNS(ns, "circle");
    track.setAttribute("class", "hud-meter__track");
    track.setAttribute("cx", "26");
    track.setAttribute("cy", "27");
    track.setAttribute("r", String(HUD_R));
    svg.appendChild(track);

    const fill = document.createElementNS(ns, "circle");
    fill.setAttribute("class", "hud-meter__fill");
    fill.setAttribute("cx", "26");
    fill.setAttribute("cy", "27");
    fill.setAttribute("r", String(HUD_R));
    fill.setAttribute("stroke", "url(#hud-ring-fill-" + kind + ")");
    fill.setAttribute("pathLength", "100");
    fill.setAttribute("stroke-dasharray", "100");
    fill.style.strokeDashoffset = "100";
    fill.setAttribute("transform", "rotate(90 26 27)");
    fill.setAttribute("id", kind === "thirst" ? "fill-thirst" : "fill-food");
    svg.appendChild(fill);

    const icon = document.createElementNS(ns, "g");
    icon.setAttribute("fill", "white");
    if (kind === "thirst") {
      icon.innerHTML =
        '<path d="M21.1 23.4188C21.7611 23.0363 22.445 22.7458 23.1518 22.5475C23.8585 22.3492 24.5811 22.25 25.3194 22.25C25.7083 22.25 26.0941 22.2783 26.4768 22.335C26.8594 22.3917 27.2385 22.4767 27.6139 22.59C28.262 22.7883 28.758 22.9229 29.1018 22.9938C29.4456 23.0646 29.8116 23.1 30.2 23.1H30.9194L31.25 19.7H20.75L21.1 23.4188ZM20.7111 35L19 18H33L31.2889 35H20.7111Z"/>';
    } else {
      icon.innerHTML =
        '<path d="M22.8031 27C23.9831 27 24.5331 26.52 25.2331 26.03C25.9931 25.5 27.1231 25.12 27.9831 25.52C28.3631 25.69 29.5231 26.03 29.9831 26.03C30.9831 26.03 32.1031 25.14 31.9731 23.74C31.7231 21.09 29.1331 19 25.9831 19C22.8331 19 20.3031 21.04 20.0031 23.66C19.8231 25.25 20.9531 27 22.8031 27ZM23.4831 22C24.3131 22 24.9831 22.67 24.9831 23.5C24.9831 24.33 24.3131 25 23.4831 25C22.6531 25 21.9831 24.33 21.9831 23.5C21.9831 22.67 22.6531 22 23.4831 22Z"/>' +
        '<path d="M35.9525 25.01C35.9725 24.74 35.9725 24.46 35.9525 24.19C35.5325 19.04 31.1625 15 25.9825 15C20.8025 15 16.5325 18.88 16.0325 24.02C15.9925 24.46 15.9925 24.89 16.0325 25.32V28.02C15.7025 31.43 17.9225 34.47 21.0825 34.93C21.9134 35.0586 22.7621 35.0111 23.5735 34.7906C24.3849 34.5701 25.1409 34.1815 25.7925 33.65C26.5925 32.99 27.6825 32.9 28.6325 33.41C29.3525 33.8 30.1725 34 30.9925 34H31.0025C32.2725 34 33.4825 33.44 34.4125 32.44C35.5125 31.24 36.0925 29.55 35.9625 28.01L35.9925 25.01H35.9625H35.9525ZM18.0225 24.21C18.4225 20.1 21.8425 17 25.9825 17C30.1225 17 33.6225 20.23 33.9525 24.35C34.0325 25.35 33.6925 26.37 33.0425 27.07C32.6525 27.49 31.9825 28 30.9825 28C30.4825 28 30.0025 27.88 29.5625 27.64C27.8925 26.74 25.9525 26.92 24.5125 28.09C23.6325 28.81 22.5125 29.12 21.3725 28.95C19.2625 28.64 17.7925 26.56 18.0225 24.21Z"/>';
    }
    svg.appendChild(icon);

    wrap.appendChild(svg);
    wrap._fill = fill;
    return wrap;
  }

  function mountHud(root) {
    hudEl = el("div", "hud");
    const thirst = buildMeter("thirst");
    const food = buildMeter("food");
    thirstFill = thirst._fill;
    foodFill = food._fill;
    hudEl.appendChild(thirst);
    hudEl.appendChild(food);
    root.appendChild(hudEl);
    setHud(0, 0);
  }

  function mount() {
    const root = document.getElementById("app");
    if (!root) return;

    menuEl = el("div", "menu");
    menuEl.style.display = "none";

    const header = el("div", "menu-header glass");
    bannerImg = img(ASSETS.banner, "menu-header__banner");
    header.appendChild(bannerImg);

    const meta = el("div", "menu-header__meta");
    headerMetaLeft = el("span", null, { text: "Description" });
    headerMetaRight = el("span", null, { text: "0/0" });
    meta.appendChild(headerMetaLeft);
    meta.appendChild(headerMetaRight);
    header.appendChild(meta);

    bodyEl = el("div", "menu-body glass");

    const footer = el("div", "menu-footer glass");
    footerEl = footer;
    footer.style.display = "none";
    footerText = el("p", "menu-footer__text", { text: "" });
    footer.appendChild(footerText);

    menuEl.appendChild(header);
    menuEl.appendChild(bodyEl);
    menuEl.appendChild(footer);
    root.appendChild(menuEl);

    mountHud(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
