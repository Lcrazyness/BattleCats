# Battle Cats audio assets

Selected audio files are downloaded by \`scripts/import_battlecats_sounds.py\` from the file pages listed in \`source-index.json\`.

Expected local files:
- \`button-click.ogg\` — pressing a button
- \`menu-select.ogg\` — navigating selections
- \`cat-base-door.ogg\` — opening the Cat Base door
- \`enter-battle.ogg\` — entering battle
- \`victory.ogg\` and \`defeat.ogg\` — battle outcomes
- \`reward.ogg\` — reward obtained
- \`capsule-draw.ogg\` — drawing a cat capsule
- \`menu-theme.ogg\` and \`battle-theme.ogg\` — background music

The project loads these local Ogg files; no sound hotlink is required while the game is running. Audio begins only after a player interaction so browser autoplay restrictions are respected.

These are copyrighted game assets from community wiki file pages, not public-domain sounds. Check rights and source-page notes before redistributing the files in a public build.
