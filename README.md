# Awesome Yoto [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> A curated list of apps, tools and resources for the Yoto Player.

[Open the portal](https://yoto-community.github.io/).

## Contents

- [Start here](#start-here)
- [Official](#official)
- [Make Your Own](#make-your-own)
- [Icons & design](#icons--design)
- [Audio & podcasts](#audio--podcasts)
- [Automation](#automation)
- [Developer tools](#developer-tools)
- [Backup & migration](#backup--migration)
- [Hardware & DIY](#hardware--diy)
- [Community & learning](#community--learning)
- [French resources](#french-resources)

## Start here

- [Build your first MYO card](https://yoto-community.github.io/myo/) - The six-step guide from audio to printed label.
- [Browse all projects](https://yoto-community.github.io/projects/) - Filter by category, status, platform and language.
- [Read the API documentation](https://yoto-community.github.io/api/) - The static JSON behind the portal.

## Official

- [twee2yoto](https://github.com/yotoplay/twee2yoto) - TypeScript library that converts Twine stories into Yoto JSON for interactive audio cards.
- [Yoto](https://yotoplay.com/) - The official Yoto website and store.
- [Yoto Developer Portal](https://yoto.dev/) - Official API documentation, OAuth setup and developer dashboard for Yoto apps.
- [Yoto Examples](https://github.com/yotoplay/examples) - Sample apps for the Yoto API in React, Next.js, Node.js, vanilla JavaScript and MQTT.
- [Yoto Space](https://yoto.space/) - Official Yoto community space to create, connect and discover audio content for children.
- [Yoto TypeScript SDK](https://github.com/yotoplay/yoto-sdk) - TypeScript SDK for Yoto's public API, covering content, devices, media, icons and family library.

## Make Your Own

- [Custom Yoto Cards](https://github.com/davidcjw/custom-yoto-cards) - Guide and zero-dependency Node script for putting custom audio on generic Yoto cards.
- [Louis](https://github.com/stuartromanek/louis) - Turn a YouTube playlist into MYO-ready audio, with automatic splitting and icons.
- [MYO Card Provisioner](https://github.com/NitsujY/yoto-myo-card-provisioner) - Single-page tool that generates a Yoto MYO URL and writes it to a blank NFC card over Web NFC.
- [MYO Studio](https://chromewebstore.google.com/detail/myo-studio/olloopaapdodegpcacjmgdjaphggfgoj) - Chrome extension that adds track tools, cover art suggestions and printing helpers to the Yoto MYO editor.
- [Yoto Card Copier](https://github.com/DovieW/yoto-card-copier) - Offline Android app that copies a linked MYO playlist from a genuine card onto a blank MIFARE tag.
- [Yoto Card Kit](https://github.com/eddowding/yoto-card-kit) - Claude Code skill that turns a YouTube link or audio file into numbered tracks, icons and card art.
- [Yoto Card Studio](https://github.com/gvinko/yoto-card-studio) - Installable web app that chapters audio, edits 16x16 icons and uploads MYO cards through the Yoto API.
- [Yoto Media Manager](https://github.com/damione1/yoto-media-manager) - Desktop app that imports audio from files or YouTube links, trims it and adds it to a Yoto playlist.
- [Yoto Playlist Creator](https://github.com/cjlm/yoto-playlist-creator) - Web app that searches YouTube, downloads audio with yt-dlp and uploads playlists as Yoto MYO cards.
- [yoto-maker](https://github.com/mmackelprang/yoto-maker) - Local Windows app that turns YouTube links or audio files into a Yoto card and prints a matching label.
- [yoto-manager](https://github.com/pg0/yoto-manager) - Browser batch editor for MYO playlists with multi-select, bulk renaming, icon assignment and MP3 upload.
- [Yoto-Music](https://github.com/blast-hardcheese/Yoto-Music) - Shell scripts that collect copied YouTube links on macOS and sync the resulting audio to a Yoto card. *(stale)*
- [YotoBookMaker](https://github.com/bbenkle/YotoBookMaker) - Native macOS app that splits audiobooks into chapters, adds icons and uploads them to Yoto.
- [yotofy](https://github.com/jstammers/yotofy) - Command-line tool that exports a Spotify playlist to a Yoto MYO card, fetching audio through spotDL.

## Icons & design

- [Selphyoto](https://github.com/m600x/Selphyoto) - Browser app that lays out and prints precisely sized Yoto card labels on a Canon Selphy CP1500 or CP1300.
- [YoPix](https://github.com/trywait/yopix-public) - Convert any image into a 16x16 pixel-art icon for Yoto MYO cards. *(stale)*
- [Yoto Icon Search](https://github.com/Schmavery/yoto-icon-search) - Chrome extension that adds a search box to the Yoto icon picker when building a Make Your Own card. *(stale)*
- [Yoto Icons Catalogue](https://yoto-community.github.io/icons-catalogue/) - Search and download 16x16 Yoto icons from three catalogues, with favourites and a pixel editor.
- [YotoIcons](https://yotoicons.com/) - A community library of 16x16 pixel icons for Yoto cards.
- [yotolabels](https://github.com/michel2323/yotolabels) - Native Windows app that prints ten Yoto card labels per Letter sheet on TownStix US-10 label paper.
- [YotoPixels](https://yotopixels.com/) - Browser tool that crops and pixelates an image into pixel-art icons for Yoto players.

## Audio & podcasts

- [Audiobookshelf Bridge](https://github.com/mylacc/yoto-audiobookshelf-bridge) - Docker service that streams Audiobookshelf books to Yoto players and keeps progress in Audiobookshelf.
- [AudioYotoShelf](https://github.com/O-Mutt/AudioYotoShelf) - Self-hosted app that transfers Audiobookshelf books to Yoto MYO cards with generated chapter icons.
- [yodex](https://github.com/jordan-wright/yodex) - Go CLI that writes and voices a short science podcast episode for children, with optional S3 publishing.
- [Yoto Browser Player](https://github.com/afsenovilla/Yoto-Audio-Player-Browser-Extension) - Browser extension that plays and downloads the tracks, icons and cover art behind a Yoto card link.
- [Yoto Podcast Catalogue](https://yoto-community.github.io/podcast-catalogue/) - Curated child-safe podcast feeds sorted by age and theme, ready for MYO cards.
- [yoto-smart-stream](https://github.com/earchibald/yoto-smart-stream) - Self-hosted Python service that streams audio to Yoto devices and reacts to MQTT events.
- [yoto-up](https://github.com/xkjq/yoto-up) - Python toolbox with CLI, TUI and GUI modes for organising Yoto playlists, icons, covers and audio.

## Automation

- [Home Assistant Yoto integration](https://www.home-assistant.io/integrations/yoto/) - Control Yoto players and read their state from Home Assistant, without HACS.
- [homebridge-yoto-player](https://github.com/ChrisPatten/homebridge-yoto-player) - Homebridge plugin that exposes Yoto players to Apple HomeKit with playback, volume and a play switch.
- [Lovelace Yoto Cards](https://github.com/tkamenick/lovelace-yoto-cards) - Five Lovelace cards that show Yoto playback, MYO library contents and listening history.
- [Yoto for Home Assistant](https://github.com/cdnninja/yoto_ha) - Custom Home Assistant integration for Yoto players, now superseded by the core integration. *(deprecated: Home Assistant core Yoto integration)*

## Developer tools

- [YOTO JSON Extractor](https://github.com/afsenovilla/YOTO-json-extractor) - Python tool that extracts a card's JSON, audio and images, embeds metadata and packs the result.
- [Yoto MCP Server](https://github.com/bperkinspdx/yoto-mcp-server) - MCP server for Warp that uploads audio and creates MYO cards through the Yoto API.
- [Yoto Node.js Client](https://github.com/bcomnes/yoto-nodejs-client) - Node.js client for the Yoto API with token refresh, MQTT device state and TypeScript types.
- [yoto_api](https://github.com/cdnninja/yoto_api) - Async Python wrapper for the Yoto API, with device control and live MQTT playback events.
- [yoto-bulk](https://github.com/eperdeme/yoto-bulk) - Audiobook pipeline that moves BorrowBox loans through Audiobookshelf and publishes books to Yoto.
- [yoto-cli](https://github.com/TheBestMoshe/yoto-cli) - Command-line tool to manage Yoto playlists, tracks, icons and devices from a terminal.
- [yoto-mcp](https://github.com/tmcinerney/yoto-mcp) - MCP server that lets AI assistants manage MYO cards, upload audio and control Yoto devices.

## Backup & migration

- [toto-backup](https://github.com/ldesgrange/toto-backup) - Python command-line tool that saves a Yoto card's tracks, icons and cover art to a local folder.
- [yoto-backup](https://github.com/seripap/yoto-backup) - Node.js script that downloads a card's artwork, metadata and tracks from its share URL. *(stale)*
- [yoto-downloader](https://github.com/baruch-moskovits/yoto-downloader) - Download the audio of cards you own for offline backup and migration. *(stale)*
- [yoto-downloader-py](https://github.com/calamonkey/yoto-downloader-py) - Python script that downloads the audio tracks behind a Yoto share link, sorted by author and title.
- [yoto-library](https://github.com/steverice/yoto-library) - Python CLI that mirrors CYO playlists as folders on disk and syncs them both ways with the Yoto API.
- [YotoTools](https://github.com/trywait/YotoTools) - Chrome extension that saves the audio, icons and metadata of cards you own as a local backup.

## Hardware & DIY

- [CircuitPython Yoto Player](https://github.com/adafruit/Adafruit_CircuitPython_YotoPlayer) - CircuitPython helper library that exposes the Yoto Player's PortalBase hardware features.
- [open-yoto](https://github.com/tensorfish/open-yoto) - Independent replacement firmware for the Yoto Mini that plays SD-card audio with NFC cards.
- [Yoto V3 Teardown](https://github.com/iamearlgrey/yoto-v3-teardown) - Teardown notes, board maps and an Arduino speaker test for the third-generation Yoto Player.
- [yotolike](https://github.com/JpTiger/yotolike) - DIY Raspberry Pi music box for kids that plays audio from RFID cards, inspired by Yoto. *(stale)*
- [yotwo](https://github.com/tomekent/yotwo) - Custom firmware that turns a second-generation Yoto Player into an Audiobookshelf client.

## Community & learning

- [Busy Busy Learning](https://busybusylearning.com/) - Family blog with Yoto card release news, player comparisons, crafts and book recommendations.
- [MYO Card Tutorial](https://github.com/BeniVidiVici/yoto-myo-card-tutorial) - Illustrated French and English tutorial for formatting a blank NFC card and linking it to a playlist.
- [r/YotoPlayer](https://www.reddit.com/r/YotoPlayer/) - Reddit community where Yoto owners share tips, questions and card ideas.

## French resources

The interface and descriptions are available in French on the [French portal](https://yoto-community.github.io/fr/). The podcast catalogue also has a [French section](https://yoto-community.github.io/podcast-catalogue/fr/).

## Contributing

Found a project that belongs here? Read [CONTRIBUTING.md](CONTRIBUTING.md) and open a pull request. Entries are validated by CI: schema, duplicates, categories and tags. Links are checked weekly.

Released under the [MIT license](LICENSE). Awesome Yoto is a community project, not affiliated with Yoto.
