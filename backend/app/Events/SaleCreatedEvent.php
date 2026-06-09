<?php

// backend/app/Events/SaleCreatedEvent.php
// Purpose: Event broadcasted when a sale is created. Handled in real time by Pusher.

namespace App\Events;

use App\Models\Sale;
use App\Http\Resources\Api\V1\SaleResource;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SaleCreatedEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $sale;

    /**
     * Create a new event instance.
     */
    public function __construct(Sale $sale)
    {
        // Force load items so they are serialized
        $this->sale = new SaleResource($sale->load('items'));
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('shop.' . $this->sale->shop_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'sale.created';
    }
}
