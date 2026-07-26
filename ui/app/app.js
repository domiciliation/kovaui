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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
