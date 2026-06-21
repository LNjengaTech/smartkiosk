<?php

namespace App\Filament\Resources\ShopSubscriptionResource\Pages;

use App\Filament\Resources\ShopSubscriptionResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListShopSubscriptions extends ListRecords
{
    protected static string $resource = ShopSubscriptionResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
