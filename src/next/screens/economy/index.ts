// «اقتصاد» in the new UI: the bank and paying a player, the backpack, the market, the shops, the auction house,
// property and the stock exchange, by the server's screen names. The economy hub itself is screens/hubs.

import type { NArea } from '../../registry'
import { BankScreen, Pay, PayConfirm, PayHelp, PaySent, PaymentDeclined } from './Bank'
import { DropConfirm, Inventory, ItemDetail, ItemDropped, ItemGiven, ItemUsed } from './Bag'
import { Book, Market, MarketCheckout, MarketRefusal, MyOrders, OrderCancelled, OrderPlaced } from './Market'
import { SellOffers, ShopBought, ShopCheckout, ShopDetail, ShopRefusal, ShopSold, Shops } from './Shops'
import { AuctionDetail, Auctions, BidPlaced, MyAuctions } from './Auctions'
import { PropertyMarket, PropertyMine } from './Property'
import { Exchange, Portfolio } from './Stocks'

const area: NArea = {
  server: {
    bank: BankScreen, pay_help: PayHelp, pay: Pay, pay_confirm: PayConfirm, pay_sent: PaySent, payment_declined: PaymentDeclined,
    inventory: Inventory, item_detail: ItemDetail, item_used: ItemUsed, item_given: ItemGiven, item_dropped: ItemDropped, drop_confirm: DropConfirm,
    market: Market, book: Book, market_checkout: MarketCheckout, order_placed: OrderPlaced, order_cancelled: OrderCancelled, my_orders: MyOrders,
    market_refusal: MarketRefusal,
    shops: Shops, shop_detail: ShopDetail, shop_checkout: ShopCheckout, shop_bought: ShopBought, sell_offers: SellOffers, shop_sold: ShopSold,
    shop_refusal: ShopRefusal,
    auctions: Auctions, auction_detail: AuctionDetail, bid_placed: BidPlaced, my_auctions: MyAuctions,
    property_market: PropertyMarket, property_mine: PropertyMine,
    exchange: Exchange, portfolio: Portfolio,
  },
}
export default area
