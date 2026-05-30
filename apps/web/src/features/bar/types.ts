// Bar types re-use the Kitchen types — same order lifecycle, different area.
export type {
  KitchenOrder as BarOrder,
  KitchenOrderItem as BarOrderItem,
  ItemStatus,
  OrderType,
  JourneyState,
  OrderCreatedPayload,
  OrderItemClaimedPayload,
  OrderItemReadyKitchenPayload,
  OrderItemUpdatedPayload,
  OrderDeliveredPayload,
  JourneyStartedPayload,
  JourneyEndedPayload,
} from '../kitchen/types'
