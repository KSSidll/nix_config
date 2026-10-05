-- settings

for typo, command in pairs { W = 'w', Q = 'q', Wq = 'wq', WQ = 'wq' } do
  vim.api.nvim_create_user_command(typo, command, {})
end

vim.opt.number = true
vim.opt.relativenumber = true

vim.opt.tabstop = 4
vim.opt.softtabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true

vim.opt.breakindent = true
vim.opt.smartindent = true

vim.opt.wrap = true

vim.opt.clipboard:append 'unnamedplus'

vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.undofile = true

vim.opt.termguicolors = true

vim.opt.hlsearch = false
vim.opt.incsearch = true
vim.opt.ignorecase = true
vim.opt.smartcase = true

vim.opt.scrolloff = 12
vim.opt.signcolumn = 'yes'

vim.opt.updatetime = 100

vim.opt.colorcolumn = '120'

vim.opt.completeopt = { 'menuone', 'noselect' }

vim.g.mapleader = " "

vim.keymap.set("n", "<leader>fv", vim.cmd.Ex)
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

-- Yank into clipboard
vim.keymap.set({"n", "v"}, "<leader>y", [["+y]])
vim.keymap.set("n", "<leader>Y", [["+Y]])

-- Paste from clipboard
vim.keymap.set({"n"}, "<leader>p", [["+p]])
vim.keymap.set({"n"}, "<leader>P", [["+P]])

vim.keymap.set({"n", "v"}, "<leader>d", [["_d]])

-- [[ Plugins ]]
-- Installed by nix (modules/editor/neovim); this file only configures them.

require('catppuccin').setup { flavour = vim.g.nix.flavor }
vim.cmd.colorscheme 'catppuccin'

require('lualine').setup {
  options = {
    icons_enabled = false,
    theme = 'catppuccin-nvim',
    component_separators = '|',
    section_separators = '',
  },
}

require('fidget').setup {}
require('Comment').setup {}
require('nvim-autopairs').setup {}
require('trouble').setup {}
require('lazydev').setup {}

-- [[ Highlight on yank ]]
vim.api.nvim_create_autocmd('TextYankPost', {
  group = vim.api.nvim_create_augroup('YankHighlight', { clear = true }),
  callback = function()
    vim.hl.on_yank()
  end,
})

-- [[ Configure Telescope ]]
require('telescope').setup {
  defaults = {
    mappings = {
      i = {
        ['<C-u>'] = false,
        ['<C-d>'] = false,
      },
    },
  },
}
require('telescope').load_extension 'fzf'

local builtin = require 'telescope.builtin'
vim.keymap.set('n', '<leader>?', builtin.oldfiles, { desc = '[?] Find recently opened files' })
vim.keymap.set('n', '<leader><space>', builtin.buffers, { desc = '[ ] Find existing buffers' })
vim.keymap.set('n', '<leader>/', function()
  builtin.current_buffer_fuzzy_find(require('telescope.themes').get_dropdown {
    winblend = 10,
    previewer = false,
  })
end, { desc = '[/] Fuzzily search in current buffer' })

vim.keymap.set('n', '<leader>gf', builtin.git_files, { desc = 'Search [G]it [F]iles' })
vim.keymap.set('n', '<leader>sf', builtin.find_files, { desc = '[S]earch [F]iles' })
vim.keymap.set('n', '<leader>sh', builtin.help_tags, { desc = '[S]earch [H]elp' })
vim.keymap.set('n', '<leader>sw', builtin.grep_string, { desc = '[S]earch current [W]ord' })
vim.keymap.set('n', '<leader>sg', builtin.live_grep, { desc = '[S]earch by [G]rep' })
vim.keymap.set('n', '<leader>sd', builtin.diagnostics, { desc = '[S]earch [D]iagnostics' })
vim.keymap.set('n', '<leader>sr', builtin.resume, { desc = '[S]earch [R]esume' })

-- [[ Configure Treesitter ]]
-- Every grammar is installed by nix, so highlighting and indent apply to any filetype that has a parser.
vim.api.nvim_create_autocmd('FileType', {
  callback = function(args)
    if pcall(vim.treesitter.start, args.buf) then
      vim.bo[args.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
    end
  end,
})

-- Incremental selection
vim.keymap.set({ 'n', 'x' }, '<C-space>', function() vim.treesitter.select('parent') end)
vim.keymap.set('x', '<M-space>', function() vim.treesitter.select('child') end)

require('nvim-treesitter-textobjects').setup {
  select = { lookahead = true },
  move = { set_jumps = true },
}

local select = require 'nvim-treesitter-textobjects.select'
for keys, capture in pairs {
  aa = '@parameter.outer',
  ia = '@parameter.inner',
  af = '@function.outer',
  ['if'] = '@function.inner',
  ac = '@class.outer',
  ic = '@class.inner',
} do
  vim.keymap.set({ 'x', 'o' }, keys, function() select.select_textobject(capture, 'textobjects') end)
end

local move = require 'nvim-treesitter-textobjects.move'
for keys, target in pairs {
  [']m'] = { move.goto_next_start, '@function.outer' },
  [']]'] = { move.goto_next_start, '@class.outer' },
  [']M'] = { move.goto_next_end, '@function.outer' },
  ['][']= { move.goto_next_end, '@class.outer' },
  ['[m'] = { move.goto_previous_start, '@function.outer' },
  ['[['] = { move.goto_previous_start, '@class.outer' },
  ['[M'] = { move.goto_previous_end, '@function.outer' },
  ['[]'] = { move.goto_previous_end, '@class.outer' },
} do
  vim.keymap.set({ 'n', 'x', 'o' }, keys, function() target[1](target[2], 'textobjects') end)
end

local swap = require 'nvim-treesitter-textobjects.swap'
vim.keymap.set('n', '<leader>a', function() swap.swap_next '@parameter.inner' end)
vim.keymap.set('n', '<leader>A', function() swap.swap_previous '@parameter.inner' end)

-- Diagnostic keymaps
vim.keymap.set('n', '[d', function() vim.diagnostic.jump { count = -1, float = true } end, { desc = 'Go to previous diagnostic message' })
vim.keymap.set('n', ']d', function() vim.diagnostic.jump { count = 1, float = true } end, { desc = 'Go to next diagnostic message' })
vim.keymap.set('n', '<leader>e', vim.diagnostic.open_float, { desc = 'Open floating diagnostic message' })
vim.keymap.set('n', '<leader>q', vim.diagnostic.setloclist, { desc = 'Open diagnostics list' })

-- [[ Configure LSP ]]
-- Servers are installed by nix (modules/dev); nvim-lspconfig supplies their default configs.
vim.api.nvim_create_autocmd('LspAttach', {
  callback = function(args)
    local nmap = function(keys, func, desc)
      vim.keymap.set('n', keys, func, { buffer = args.buf, desc = 'LSP: ' .. desc })
    end

    nmap('<leader>rn', vim.lsp.buf.rename, '[R]e[n]ame')
    nmap('<leader>ca', vim.lsp.buf.code_action, '[C]ode [A]ction')

    nmap('gd', vim.lsp.buf.definition, '[G]oto [D]efinition')
    nmap('gr', builtin.lsp_references, '[G]oto [R]eferences')
    nmap('gI', builtin.lsp_implementations, '[G]oto [I]mplementation')
    nmap('<leader>D', vim.lsp.buf.type_definition, 'Type [D]efinition')
    nmap('<leader>ds', builtin.lsp_document_symbols, '[D]ocument [S]ymbols')
    nmap('<leader>ws', builtin.lsp_dynamic_workspace_symbols, '[W]orkspace [S]ymbols')

    nmap('K', vim.lsp.buf.hover, 'Hover Documentation')
    nmap('<C-k>', vim.lsp.buf.signature_help, 'Signature Documentation')

    nmap('gD', vim.lsp.buf.declaration, '[G]oto [D]eclaration')
    nmap('<leader>wa', vim.lsp.buf.add_workspace_folder, '[W]orkspace [A]dd Folder')
    nmap('<leader>wr', vim.lsp.buf.remove_workspace_folder, '[W]orkspace [R]emove Folder')
    nmap('<leader>wl', function()
      print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
    end, '[W]orkspace [L]ist Folders')

    vim.api.nvim_buf_create_user_command(args.buf, 'Format', function(_)
      vim.lsp.buf.format()
    end, { desc = 'Format current buffer with LSP' })
  end,
})

vim.lsp.config('*', {
  capabilities = require('cmp_nvim_lsp').default_capabilities(),
})

vim.lsp.config('intelephense', {
  settings = {
    intelephense = {
      telemetry = { enabled = false },
      diagnostics = { run = 'onSave' },
    },
  },
})

vim.lsp.config('lua_ls', {
  settings = {
    Lua = {
      workspace = { checkThirdParty = false },
      telemetry = { enable = false },
    },
  },
})

vim.lsp.enable { 'clangd', 'pyright', 'intelephense', 'lua_ls', 'nixd' }

-- lspconfig's rust_analyzer resolves its root by running rustc, which errors on every .rs buffer
-- unless a toolchain (e.g. a project dev shell) is on PATH
if vim.fn.executable 'rustc' == 1 then
  vim.lsp.enable 'rust_analyzer'
end

-- [[ Configure nvim-cmp ]]
local cmp = require 'cmp'
local luasnip = require 'luasnip'
require('luasnip.loaders.from_vscode').lazy_load()
luasnip.config.setup {}

cmp.event:on('confirm_done', require('nvim-autopairs.completion.cmp').on_confirm_done())

cmp.setup {
  snippet = {
    expand = function(args)
      luasnip.lsp_expand(args.body)
    end,
  },
  mapping = cmp.mapping.preset.insert {
    ['<C-n>'] = cmp.mapping.select_next_item(),
    ['<C-p>'] = cmp.mapping.select_prev_item(),
    ['<C-d>'] = cmp.mapping.scroll_docs(-4),
    ['<C-f>'] = cmp.mapping.scroll_docs(4),
    ['<C-Space>'] = cmp.mapping.complete {},
    ['<CR>'] = cmp.mapping.confirm {
      behavior = cmp.ConfirmBehavior.Replace,
      select = true,
    },
  },
  sources = {
    { name = 'lazydev', group_index = 0 },
    { name = 'nvim_lsp' },
    { name = 'luasnip' },
    { name = 'buffer' },
  },
}

-- vim: ts=2 sts=2 sw=2 et
