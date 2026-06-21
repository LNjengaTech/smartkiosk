<?php

namespace App\Filament\Resources\ShopSubscriptionResource\Pages;

use App\Filament\Resources\ShopSubscriptionResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditShopSubscription extends EditRecord
{
    protected static string $resource = ShopSubscriptionResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
