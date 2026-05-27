<?php

// backend/app/Models/SyncLog.php
// Purpose: Append-only log tracking offline synchronizations and resolution conflicts.

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SyncLog extends Model
{
    // Append-only ledger - disable default updated_at field
    const UPDATED_AT = null;

    protected $table = 'sync_logs';

    protected $fillable = [
        'shop_id',
        'user_id',
        'operation_uuid',
        'resource_type',
        'resource_uuid',
        'status',
        'conflict_resolution',
        'synced_at',
    ];

    protected $casts = [
        'synced_at' => 'datetime',
    ];

    /**
     * Get the shop related to this synchronization action.
     */
    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'shop_id');
    }

    /**
     * Get the staff user who synchronized this action.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
