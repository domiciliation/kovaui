---============================================================================
--- @author      benewww.pro@gmail.com
--- @discord     domiciliation
--- @copyright   © 2026 Tous droits réservés.
--- @license     Proprietary - All Rights Reserved
---
--- Ce code est protégé par le droit d'auteur.
--- Toute copie, modification, redistribution, revente, décompilation,
--- déobfuscation ou utilisation non autorisée est strictement interdite.
---
--- L'utilisation de ce fichier implique l'acceptation des conditions de
--- licence définies par l'auteur.
---============================================================================

lib = {}
lib.opened = false
lib.mouse = false

local menus = {}
local stack = {}

local function serializeMenu(menu)
    local options = {}
    for i, opt in ipairs(menu.options or {}) do
        options[#options + 1] = {
            label = opt.label or '',
            description = opt.description,
            type = opt.type or 'button',
            checked = opt.checked == true,
            values = opt.values,
            value = opt.value or 1,
            menu = opt.menu,
            disabled = opt.disabled == true,
            close = opt.close,
        }
    end

    return {
        id = menu.id,
        title = menu.title or '',
        subtitle = menu.subtitle or '',
        description = menu.description or '',
        banner = menu.banner,
        options = options,
    }
end

local function pushMenu(id, replace)
    local menu = menus[id]
    if not menu then return false end

    if replace then
        stack[#stack] = id
    else
        stack[#stack + 1] = id
    end

    SendNUIMessage({
        action = 'setMenu',
        menu = serializeMenu(menu),
        depth = #stack,
    })

    return true
end

function lib.createMenu(data)
    if type(data) ~= 'table' or not data.id then
        error('lib.createMenu: id requis')
    end

    menus[data.id] = data
    return data.id
end

function lib.setMenuOptions(id, options)
    if not menus[id] then return end
    menus[id].options = options

    if lib.opened and stack[#stack] == id then
        SendNUIMessage({
            action = 'setMenu',
            menu = serializeMenu(menus[id]),
            depth = #stack,
        })
    end
end

function lib.openMenu(id)
    if not menus[id] then return end

    stack = { id }
    lib.opened = true
    lib.mouse = false

    SendNUIMessage({
        action = 'showMenu',
        menu = serializeMenu(menus[id]),
        depth = 1,
    })

    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
end

function lib.closeMenu()
    if not lib.opened then return end

    local current = stack[#stack]
    local menu = current and menus[current] or nil

    stack = {}
    lib.opened = false
    lib.mouse = false

    SendNUIMessage({ action = 'hideMenu' })
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)

    if menu and menu.onClose then
        menu.onClose()
    end
end

function lib.getOpenMenu()
    return stack[#stack]
end

function lib.backMenu()
    if not lib.opened then return end
    if #stack <= 1 then
        lib.closeMenu()
        return
    end
    stack[#stack] = nil
    local id = stack[#stack]
    SendNUIMessage({
        action = 'setMenu',
        menu = serializeMenu(menus[id]),
        depth = #stack,
    })
end

exports('createMenu', lib.createMenu)
exports('setMenuOptions', lib.setMenuOptions)
exports('openMenu', lib.openMenu)
exports('closeMenu', lib.closeMenu)
exports('backMenu', lib.backMenu)
exports('getOpenMenu', lib.getOpenMenu)

RegisterNUICallback('closeMenu', function(_, cb)
    lib.closeMenu()
    cb('ok')
end)

RegisterNUICallback('backMenu', function(_, cb)
    lib.backMenu()
    cb('ok')
end)

RegisterNUICallback('selectOption', function(data, cb)
    local id = stack[#stack]
    local menu = id and menus[id]
    local index = tonumber(data and data.index)
    if not menu or not index then
        cb('ok')
        return
    end

    local opt = menu.options and menu.options[index]
    if not opt or opt.disabled then
        cb('ok')
        return
    end

    local typ = opt.type or 'button'
    if typ == 'separator' then
        cb('ok')
        return
    end

    if typ == 'submenu' and opt.menu then
        pushMenu(opt.menu, false)
    elseif typ == 'checkbox' then
        opt.checked = not opt.checked
        SendNUIMessage({
            action = 'updateOption',
            index = index,
            checked = opt.checked,
        })
        if opt.onChange then
            opt.onChange(opt.checked, opt, menu)
        end
        if opt.onSelect then
            opt.onSelect(opt.checked, opt, menu)
        end
    elseif typ == 'slider' then
        if opt.onSelect then
            local values = opt.values or {}
            local value = opt.value or 1
            opt.onSelect(values[value], value, opt, menu)
        end
    else
        if opt.onSelect then
            opt.onSelect(opt, menu)
        end
        if opt.close then
            lib.closeMenu()
        end
    end

    cb('ok')
end)

RegisterNUICallback('changeSlider', function(data, cb)
    local id = stack[#stack]
    local menu = id and menus[id]
    local index = tonumber(data and data.index)
    local value = tonumber(data and data.value)
    if not menu or not index or not value then
        cb('ok')
        return
    end

    local opt = menu.options and menu.options[index]
    if not opt or opt.type ~= 'slider' or not opt.values then
        cb('ok')
        return
    end

    local max = #opt.values
    if value < 1 then value = max end
    if value > max then value = 1 end
    opt.value = value

    SendNUIMessage({
        action = 'updateOption',
        index = index,
        value = value,
    })

    if opt.onChange then
        opt.onChange(opt.values[value], value, opt, menu)
    end

    cb('ok')
end)

CreateThread(function()
    while true do
        if lib.opened then
            local alt = IsControlPressed(0, 19) or IsDisabledControlPressed(0, 19)

            if alt and not lib.mouse then
                lib.mouse = true
                SetNuiFocus(true, true)
                SetNuiFocusKeepInput(true)
            elseif not alt and lib.mouse then
                lib.mouse = false
                SetNuiFocus(false, false)
                SetNuiFocusKeepInput(false)
            end

            if lib.mouse then
                DisableControlAction(0, 1, true)
                DisableControlAction(0, 2, true)
                DisableControlAction(0, 24, true)
                DisableControlAction(0, 25, true)
                DisableControlAction(0, 142, true)
                DisableControlAction(0, 106, true)
            else
                if IsControlJustPressed(0, 172) then
                    SendNUIMessage({ action = 'key', key = 'up' })
                elseif IsControlJustPressed(0, 173) then
                    SendNUIMessage({ action = 'key', key = 'down' })
                elseif IsControlJustPressed(0, 174) then
                    SendNUIMessage({ action = 'key', key = 'left' })
                elseif IsControlJustPressed(0, 175) then
                    SendNUIMessage({ action = 'key', key = 'right' })
                elseif IsControlJustPressed(0, 191) or IsControlJustPressed(0, 201) then
                    SendNUIMessage({ action = 'key', key = 'enter' })
                elseif IsControlJustPressed(0, 194) or IsControlJustPressed(0, 202) then
                    SendNUIMessage({ action = 'key', key = 'back' })
                elseif IsControlJustPressed(0, 200) or IsControlJustPressed(0, 177) then
                    SendNUIMessage({ action = 'key', key = 'escape' })
                end
            end

            Wait(0)
        else
            Wait(200)
        end
    end
end)

-- Exemple
lib.createMenu({
    id = 'main',
    title = 'Description',
    description = 'Menu principal Kova UI. Utilise les fleches et Enter. Maintiens ALT pour la souris.',
    options = {
        { label = 'Subtitle', type = 'separator' },
        {
            label = 'Ouvrir un sous-menu',
            type = 'submenu',
            menu = 'settings',
            description = 'Accede aux parametres.',
        },
        {
            label = 'Just a button.',
            type = 'button',
            description = 'Action simple.',
            onSelect = function()
                print('button selected')
            end,
        },
        { label = 'Options', type = 'separator' },
        {
            label = 'Just a checkbox.',
            type = 'checkbox',
            checked = true,
            description = 'Active / desactive une option.',
            onChange = function(checked)
                print('checkbox', checked)
            end,
        },
        {
            label = 'Just a slider.',
            type = 'slider',
            values = { 'Option 1', 'Option 2', 'Option 3', 'Option 4' },
            value = 1,
            description = 'Change avec fleches gauche / droite.',
            onChange = function(val, index)
                print('slider', val, index)
            end,
        },
        {
            label = 'Fermer',
            type = 'button',
            close = true,
            description = 'Ferme le menu.',
        },
    },
})

lib.createMenu({
    id = 'settings',
    title = 'Description',
    description = 'Sous-menu exemple. Backspace pour revenir.',
    options = {
        { label = 'Parametres', type = 'separator' },
        {
            label = 'Qualite',
            type = 'slider',
            values = { 'Low', 'Medium', 'High' },
            value = 2,
            onChange = function(val)
                print('quality', val)
            end,
        },
        {
            label = 'Notifications',
            type = 'checkbox',
            checked = false,
            onChange = function(checked)
                print('notif', checked)
            end,
        },
    },
})

RegisterCommand('menu', function()
    if lib.opened then
        lib.closeMenu()
    else
        lib.openMenu('main')
    end
end)

RegisterKeyMapping('menu', 'Ouvrir le menu lib', 'keyboard', 'F5')
