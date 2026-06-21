<?php

namespace App\Filament\Resources\SubscriptionTierResource\Pages;

use App\Filament\Resources\SubscriptionTierResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListSubscriptionTiers extends ListRecords
{
    protected static string $resource = SubscriptionTierResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
