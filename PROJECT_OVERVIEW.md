# Fringe Matrix Gallery - Project Overview

## What This Project Is

The **Fringe Matrix Gallery** is a web application that serves as a digital archive and interactive gallery for fan-created avatar images related to the TV show "Fringe" (2008-2013). Specifically, it showcases image collections that were created for Twitter hashtag campaigns that coincided with each episode during the show's later seasons.

## Core Purpose

This application provides an organized, searchable interface for browsing through extensive collections of fan-created avatar images that were used during coordinated Twitter campaigns for individual Fringe episodes. Each campaign had its own hashtag and corresponding set of themed avatar images that fans could use to show their support for the show.

## Technical Architecture

### Frontend (React/Vite)
- **Technology**: React 18 with Vite build system
- **Purpose**: Single-page application with modern UI/UX
- **Features**:
  - Campaign/episode browser with sidebar navigation
  - Interactive lightbox for viewing images
  - Responsive design with animations
  - Preloading system for smooth user experience
  - Share functionality and build information display

### Backend (Express.js)
- **Technology**: Node.js with Express server
- **Purpose**: API server and static file hosting
- **Functionality**:
  - Serves campaign metadata from YAML configuration
  - Hosts avatar image collections
  - Provides build/deployment information
  - Auto-discovery of image files in avatar directories

### Data Structure
- **Campaigns**: Organized by TV show seasons (Season 4 & 5)
- **Episodes**: Each campaign corresponds to a specific Fringe episode
- **Images**: Multiple avatar variations per campaign (different colors, artists)
- **Metadata**: Episode dates, IMDB links, wiki references, and fandom site links

## Content Organization

The project contains:
- **24 Twitter campaigns** spanning Fringe Seasons 4-5 (2012-2013)
- **Thousands of avatar images** organized by campaign and artist
- **Multiple artists/contributors** including CheriBot, SarahProost, Zort70, GoldenMonkey, and others
- **Rich metadata** linking campaigns to specific episodes, air dates, and external references

## Key Features

1. **Campaign Browser**: Navigate through chronologically organized Twitter campaigns
2. **Image Gallery**: View avatar collections with lightbox functionality  
3. **Episode Metadata**: Access episode information, external links, and campaign details
4. **Responsive Design**: Works across desktop and mobile devices
5. **Modern UI**: Clean, futuristic interface fitting the show's aesthetic
6. **Performance Optimization**: Image preloading and efficient navigation

## Historical Context

This project serves as a digital preservation effort for fan-created content from the Fringe TV series' final seasons. The Twitter campaigns were part of fan efforts to support the show and increase viewership during its final years (2012-2013). Each campaign was timed to coincide with specific episode airings and encouraged fans to use themed avatars and hashtags during live-tweeting.

## Development & Deployment

- **Testing**: Comprehensive test suite including unit tests (Jest/Vitest) and E2E tests (Playwright)
- **Deployment**: Automated deployment scripts for Linux servers
- **Build System**: Modern JavaScript tooling with Vite
- **Development**: Hot-reloading dev environment with separate client/server processes

This project represents both a functional web application and a piece of television fandom history, preserving the creative output of a dedicated fan community from the early 2010s.