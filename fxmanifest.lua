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

fx_version 'cerulean'
game 'gta5'
lua54 'yes'
author '<benewww.pro@gmail.com>, dc: domiciliation'
use_experimental_fivem_natives 'yes'
ui_page { 'ui/app/index.html' }
client_scripts {
  'modules/**/CLib.lua',
  'modules/**/CHud.lua',
}
files { 'ui/**/*' }

exports {'createMenu', 'setMenuOptions',
         'openMenu','closeMenu',
         'backMenu', 'getOpenMenu',
         'setHud', 'setHudThirst', 'setHudFood',
         'showHud', 'hideHud',
}