import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, ContextTypes
from telegram.request import HTTPXRequest

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

WEB_APP_URL = "https://kerudawud709.github.io/bingo-webapp/"

MAIN_MENU_TEXT = (
    "<b>Welcome to Yeketema Bingo!</b> 🎲\n\n"
    "Select an option below to play or manage your account."
)

CARTELA_TEMPLATE = (
    "🎰 <b>YOUR BINGO CARTELA</b>\n\n"
    "<pre>\n"
    "┌────┬────┬────┬────┬────┐\n"
    "│ B  │ I  │ N  │ G  │ O  │\n"
    "├────┼────┼────┼────┼────┤\n"
    "│ 03 │ 23 │ 33 │ 59 │ 75 │\n"
    "│ 12 │ 26 │ 45 │ 51 │ 64 │\n"
    "│ 01 │ 28 │ 🟨 │ 56 │ 69 │\n"
    "│ 08 │ 22 │ 35 │ 54 │ 66 │\n"
    "│ 06 │ 27 │ 32 │ 57 │ 70 │\n"
    "└────┴────┴────┴────┴────┘\n"
    "</pre>\n"
    "<b>Status:</b> Game in progress... 🟢"
)

WALLET_TEXT = (
    "💳 <b>YOUR WALLET</b>\n\n"
    "<b>Balance:</b> 0.00 ETB\n"
    "<b>Cartelas Bought:</b> 0"
)

HELP_TEXT = (
    "📖 <b>HOW TO PLAY</b>\n\n"
    "1. Tap <b>Play Now</b> to launch the WebApp.\n"
    "2. Numbers will be drawn automatically.\n"
    "3. Complete a row, column, or diagonal to win!"
)

def get_main_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🎮 Play Now", web_app=WebAppInfo(url=WEB_APP_URL))],
        [InlineKeyboardButton("💳 Wallet & Balance", callback_data="view_wallet")],
        [InlineKeyboardButton("❓ Instructions", callback_data="view_help")]
    ])

def get_back_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔙 Back to Main Menu", callback_data="view_main")]
    ])

async def start(update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        MAIN_MENU_TEXT,
        reply_markup=get_main_keyboard(),
        parse_mode="HTML"
    )

async def button_router(update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if data == "view_main":
        await query.edit_message_text(MAIN_MENU_TEXT, reply_markup=get_main_keyboard(), parse_mode="HTML")
    elif data == "view_cartela":
        await query.edit_message_text(CARTELA_TEMPLATE, reply_markup=get_back_keyboard(), parse_mode="HTML")
    elif data == "view_wallet":
        await query.edit_message_text(WALLET_TEXT, reply_markup=get_back_keyboard(), parse_mode="HTML")
    elif data == "view_help":
        await query.edit_message_text(HELP_TEXT, reply_markup=get_back_keyboard(), parse_mode="HTML")

if __name__ == '__main__':
    TOKEN = "8747954474:AAF6gqd0_4Rji6_qWKS7ZdyqF2fUKNLIvU4"
    
    request = HTTPXRequest(connect_timeout=20, read_timeout=20)
    app = ApplicationBuilder().token(TOKEN).request(request).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_router))

    print("Bot running...")
    app.run_polling()

