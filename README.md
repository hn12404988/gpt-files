# gpt-files

## Description

`gpt-files` is a CLI tool for managing vector stores files for OpenAI assistant.

## Installation

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Positive-LLC/gpt-files/refs/heads/main/install.sh)"
```

## Usage

### Development

To run the CLI tool in development mode:

```sh
deno task dev -- [command] [options]
```

### Compilation

To compile the CLI tool for different platforms:

```sh
deno task compile
```

This will generate the binaries in the `dist` directory for the following
platforms:

- Linux x86_64
- Linux ARM64
- macOS x86_64
- macOS ARM64

## Commands

To see the available commands and options, please run `--help`. Not only in root command but also recursively:

```sh
gpt-files --help
gpt-files upload --help
```
