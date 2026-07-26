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

hud = hud or {}
hud.visible = true
hud.thirst = 50
hud.food = 75

local function clamp(v)
    v = tonumber(v) or 0
    if v < 0 then return 0 end
    if v > 100 then return 100 end
    return v + 0.0
end

function hud.set(thirst, food)
    if thirst ~= nil then hud.thirst = clamp(thirst) end
    if food ~= nil then hud.food = clamp(food) end

    SendNUIMessage({
        action = 'setHud',
        thirst = hud.thirst,
        food = hud.food,
    })
end

function hud.setThirst(value)
    hud.thirst = clamp(value)
    SendNUIMessage({
        action = 'setHudThirst',
        value = hud.thirst,
    })
end

function hud.setFood(value)
    hud.food = clamp(value)
    SendNUIMessage({
        action = 'setHudFood',
        value = hud.food,
    })
end

function hud.show(thirst, food)
    if thirst ~= nil then hud.thirst = clamp(thirst) end
    if food ~= nil then hud.food = clamp(food) end
    hud.visible = true
    SendNUIMessage({
        action = 'showHud',
        thirst = hud.thirst,
        food = hud.food,
    })
end

function hud.hide()
    hud.visible = false
    SendNUIMessage({ action = 'hideHud' })
end

exports('setHud', hud.set)
exports('setHudThirst', hud.setThirst)
exports('setHudFood', hud.setFood)
exports('showHud', hud.show)
exports('hideHud', hud.hide)

CreateThread(function()
    Wait(500)
    if hud.visible then
        hud.show(hud.thirst, hud.food)
    end
end)


RegisterCommand("fillfood", function(commandName, args)
    hud.setFood(args[1])
end)